"""
评分任务 API — 创建/查询/重试
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
import threading

from db import DB
from database import get_connection
from services.llm_scorer import score_and_describe_image

router = APIRouter(prefix="/api", tags=["scoring"])

# 并发限制
_score_semaphore = threading.Semaphore(4)


class ScoreRequest(BaseModel):
    image_ids: List[int]
    model: str = "local"


@router.post("/images/score")
async def score_images(req: ScoreRequest):
    """创建评分任务（异步，不等待结果）"""
    from datetime import datetime

    task_ids = []

    for image_id in req.image_ids:
        # 检查是否有处理中任务
        processing = DB.score_tasks_check_processing(image_id)
        if processing:
            created_at = processing['created_at']
            from datetime import datetime, timedelta, timezone
            try:
                now = datetime.now(timezone.utc).astimezone() if created_at.tzinfo else datetime.now()
                age = now - created_at
                if age > timedelta(minutes=2):
                    DB.score_tasks_fail_old(processing['id'], '处理超时自动重置')
                else:
                    continue
            except Exception:
                continue

        # 检查待处理
        if DB.score_tasks_check_pending(image_id):
            continue

        # 创建任务
        task_id = DB.score_tasks_create(image_id, req.model)
        task_ids.append({"image_id": image_id, "task_id": task_id})

    for tid in task_ids:
        def process_one(task_id=tid['task_id'], image_id=tid['image_id'], model=req.model):
            _score_semaphore.acquire()
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(
                    "UPDATE score_tasks SET status = 'processing' WHERE id = %s AND status = 'pending'",
                    (task_id,)
                )
                conn.commit()
                if cursor.rowcount == 0:
                    return

                cursor.execute("SELECT file_path FROM images WHERE id = %s AND is_deleted = 0", (image_id,))
                img = cursor.fetchone()
                if not img:
                    DB.score_tasks_fail_for_image(image_id, task_id, 'Image not found')
                    conn.commit()
                    return

                result = score_and_describe_image(image_id, img['file_path'], model)
                if result.get('scored') or result.get('described'):
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'completed', completed_at = NOW() WHERE id = %s",
                        (task_id,)
                    )
                else:
                    DB.score_tasks_fail_for_image(image_id, task_id, 'LLM call failed')
                conn.commit()
            except Exception as e:
                cursor.execute(
                    "UPDATE score_tasks SET status = 'failed', error_message = %s WHERE id = %s",
                    (str(e), task_id)
                )
                conn.commit()
            finally:
                _score_semaphore.release()
                cursor.close()
                conn.close()

        t = threading.Thread(target=process_one, args=(tid['task_id'], tid['image_id'], req.model), daemon=True)
        t.start()

    return {"message": "评分任务已创建", "tasks": task_ids}


@router.get("/images/score/status/{image_id}")
async def get_score_status(image_id: int):
    """获取图片评分状态"""
    result = DB.score_tasks_get_status(image_id)
    if result:
        return result
    return {"status": "not_found"}


@router.get("/images/score/results/{image_id}")
async def get_score_results(image_id: int):
    """获取图片评分结果"""
    return DB.score_results_get(image_id)


@router.get("/score-tasks")
async def get_score_tasks(
    status: Optional[str] = Query(None, enum=["pending", "processing", "completed", "failed"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """获取评分任务列表"""
    total, tasks = DB.score_tasks_list(status, page, page_size)
    return {"tasks": tasks, "total": total, "page": page, "page_size": page_size}


@router.post("/score-tasks/retry")
async def retry_score_tasks(image_ids: List[int]):
    """重新评分"""
    task_ids = []
    for image_id in image_ids:
        DB.score_tasks_reset(image_id)
        existing = DB.score_tasks_check_pending(image_id)
        if not existing:
            continue
        task_id = existing['id']
        task_ids.append({"image_id": image_id, "task_id": task_id})

    if not task_ids:
        return {"success": False, "error": "所选图片已完成评分，无法重跑"}

    for tid in task_ids:
        def process_one(task_id=tid['task_id'], image_id=tid['image_id']):
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(
                    "UPDATE score_tasks SET status = 'processing' WHERE id = %s AND status = 'pending'",
                    (task_id,)
                )
                conn.commit()
                if cursor.rowcount == 0:
                    return

                file_path = DB.images_get_path(image_id)
                if not file_path:
                    DB.score_tasks_fail_for_image(image_id, task_id, 'Image not found')
                    conn.commit()
                    return

                _score_semaphore.acquire()
                try:
                    model = DB.score_tasks_get_model(task_id) or 'local'
                    result = score_and_describe_image(image_id, file_path, model)
                    if result.get('scored') or result.get('described'):
                        DB.score_tasks_complete(image_id)
                    else:
                        DB.score_tasks_fail_for_image(image_id, task_id, 'LLM call failed')
                except Exception as e:
                    DB.score_tasks_fail_for_image(image_id, task_id, str(e))
                finally:
                    _score_semaphore.release()
                conn.commit()
            finally:
                cursor.close()
                conn.close()

        t = threading.Thread(target=process_one, args=(tid['task_id'], tid['image_id']), daemon=True)
        t.start()

    return {"success": True, "tasks": task_ids}
