"""
评分任务 API — 创建/查询/重试
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
import threading

from database import execute_query, get_connection
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
        processing = execute_query(
            "SELECT id, created_at FROM score_tasks WHERE image_id = %s AND status = 'processing'",
            (image_id,)
        )
        if processing:
            task = processing[0]
            created_at = task['created_at']
            from datetime import datetime, timedelta, timezone
            try:
                now = datetime.now(timezone.utc).astimezone() if created_at.tzinfo else datetime.now()
                age = now - created_at
                if age > timedelta(minutes=2):
                    execute_query(
                        "UPDATE score_tasks SET status = 'failed', error_message = '处理超时自动重置' WHERE id = %s",
                        (task['id'],)
                    )
                else:
                    continue
            except Exception:
                continue

        # 检查待处理
        existing = execute_query(
            "SELECT id FROM score_tasks WHERE image_id = %s AND status = 'pending'",
            (image_id,)
        )
        if existing:
            continue

        # 创建任务
        task_id = execute_query(
            "INSERT INTO score_tasks (image_id, status, model) VALUES (%s, 'pending', %s)",
            (image_id, req.model), fetch=False
        )
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
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'failed', error_message = 'Image not found' WHERE id = %s",
                        (task_id,)
                    )
                    conn.commit()
                    return

                result = score_and_describe_image(image_id, img['file_path'], model)
                if result.get('scored') or result.get('described'):
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'completed', completed_at = NOW() WHERE id = %s",
                        (task_id,)
                    )
                else:
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'failed', error_message = 'LLM call failed' WHERE id = %s",
                        (task_id,)
                    )
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
    result = execute_query(
        "SELECT status, error_message, completed_at FROM score_tasks WHERE image_id = %s ORDER BY id DESC LIMIT 1",
        (image_id,)
    )
    if result:
        return result[0]
    return {"status": "not_found"}


@router.get("/images/score/results/{image_id}")
async def get_score_results(image_id: int):
    """获取图片评分结果"""
    result = execute_query(
        """SELECT i.*,
               s.total_score,
               s.impact_score, s.impact_analysis, s.impact_suggestion,
               s.composition_score, s.composition_analysis, s.composition_suggestion,
               s.sharpness_score, s.sharpness_analysis, s.sharpness_suggestion,
               s.exposure_score, s.exposure_analysis, s.exposure_suggestion,
               s.color_score, s.color_analysis, s.color_suggestion,
               s.uniqueness_score, s.uniqueness_analysis, s.uniqueness_suggestion,
               d.description, d.tags
        FROM images i
        LEFT JOIN image_scores s ON i.id = s.image_id
        LEFT JOIN image_descriptions d ON i.id = d.image_id
        WHERE i.id = %s""",
        (image_id,)
    )
    if result:
        return result[0]
    return None


@router.get("/score-tasks")
async def get_score_tasks(
    status: Optional[str] = Query(None, enum=["pending", "processing", "completed", "failed"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """获取评分任务列表"""
    where_sql = "WHERE 1=1"
    params = []
    if status:
        where_sql += " AND t.status = %s"
        params.append(status)

    count_sql = f"SELECT COUNT(*) as total FROM score_tasks t {where_sql}"
    total = execute_query(count_sql, params)[0]['total']

    offset = (page - 1) * page_size
    query_sql = f"""
        SELECT t.id, t.image_id, t.status, t.model, t.error_message,
               t.created_at, t.completed_at,
               i.filename, i.file_path, i.width, i.height
        FROM score_tasks t
        LEFT JOIN images i ON t.image_id = i.id
        {where_sql}
        ORDER BY t.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([page_size, offset])
    tasks = execute_query(query_sql, params)

    return {"tasks": tasks, "total": total, "page": page, "page_size": page_size}


@router.post("/score-tasks/retry")
async def retry_score_tasks(image_ids: List[int]):
    """重新评分"""
    task_ids = []
    for image_id in image_ids:
        execute_query(
            "UPDATE score_tasks SET status = 'pending', error_message = NULL WHERE image_id = %s AND status IN ('failed', 'processing')",
            (image_id,), fetch=False
        )
        existing = execute_query(
            "SELECT id FROM score_tasks WHERE image_id = %s AND status = 'pending'",
            (image_id,)
        )
        if not existing:
            continue
        task_id = existing[0]['id']
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

                cursor.execute("SELECT file_path FROM images WHERE id = %s AND is_deleted = 0", (image_id,))
                img = cursor.fetchone()
                if not img:
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'failed', error_message = 'Image not found' WHERE id = %s",
                        (task_id,)
                    )
                    conn.commit()
                    return

                _score_semaphore.acquire()
                try:
                    cursor.execute("SELECT model FROM score_tasks WHERE id = %s", (task_id,))
                    task = cursor.fetchone()
                    model = task['model'] if task else 'local'
                    result = score_and_describe_image(image_id, img['file_path'], model)
                    if result.get('scored') or result.get('described'):
                        cursor.execute(
                            "UPDATE score_tasks SET status = 'completed', completed_at = NOW() WHERE image_id = %s",
                            (image_id,)
                        )
                    else:
                        cursor.execute(
                            "UPDATE score_tasks SET status = 'failed', error_message = 'LLM call failed' WHERE id = %s",
                            (task_id,)
                        )
                except Exception as e:
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'failed', error_message = %s WHERE id = %s",
                        (str(e), task_id)
                    )
                finally:
                    _score_semaphore.release()
                conn.commit()
            finally:
                cursor.close()
                conn.close()

        t = threading.Thread(target=process_one, args=(tid['task_id'], tid['image_id']), daemon=True)
        t.start()

    return {"success": True, "tasks": task_ids}
