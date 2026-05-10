"""
文件夹 + 图片列表 + 扫描 API
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
import threading
import time
import uuid

from database import execute_query
from services.image_scanner import scan_folders, index_folder

router = APIRouter(prefix="/api", tags=["folders"])

# 后台扫描任务状态
_scan_tasks = {}
_scan_lock = threading.Lock()


class FolderScanRequest(BaseModel):
    folder_path: str


@router.get("/folders")
async def get_folders():
    """获取目录树"""
    folders = scan_folders()
    return {"folders": folders}


@router.get("/folders/{folder_path:path}/images")
async def get_folder_images(
    folder_path: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    sort_by: str = Query("filename", enum=["filename", "total_score", "file_size", "created_at"]),
    sort_order: str = Query("asc", enum=["asc", "desc"]),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = None
):
    """获取指定文件夹的图片列表"""
    folder_path = folder_path.replace('/', '\\')

    where_clauses = ["i.is_deleted = 0", "i.folder_path = %s"]
    params = [folder_path]

    if min_score is not None:
        where_clauses.append("s.total_score >= %s")
        params.append(min_score)

    if search:
        where_clauses.append("(i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s)")
        pattern = f"%{search}%"
        params.extend([pattern, pattern, pattern])

    where_sql = " AND ".join(where_clauses)
    sort_column = {
        "filename": "i.filename", "total_score": "s.total_score",
        "file_size": "i.file_size", "created_at": "i.created_at"
    }.get(sort_by, "i.filename")
    sort_dir = "DESC" if sort_order == "desc" else "ASC"

    count_sql = f"""
        SELECT COUNT(*) as total FROM images i
        LEFT JOIN image_scores s ON i.id = s.image_id
        LEFT JOIN image_descriptions d ON i.id = d.image_id
        WHERE {where_sql}
    """
    total = execute_query(count_sql, params)[0]['total']

    offset = (page - 1) * page_size
    query_sql = f"""
        SELECT i.*,
               s.total_score,
               s.impact_score, s.impact_analysis, s.impact_suggestion,
               s.composition_score, s.composition_analysis, s.composition_suggestion,
               s.sharpness_score, s.sharpness_analysis, s.sharpness_suggestion,
               s.exposure_score, s.exposure_analysis, s.exposure_suggestion,
               s.color_score, s.color_analysis, s.color_suggestion,
               s.uniqueness_score, s.uniqueness_analysis, s.uniqueness_suggestion,
               d.description, d.tags
        FROM images i
        LEFT JOIN image_scores s ON s.id = (
            SELECT id FROM image_scores WHERE image_id = i.id ORDER BY scored_at DESC LIMIT 1
        )
        LEFT JOIN image_descriptions d ON d.id = (
            SELECT id FROM image_descriptions WHERE image_id = i.id ORDER BY created_at DESC LIMIT 1
        )
        WHERE {where_sql}
        ORDER BY {sort_column} {sort_dir}
        LIMIT %s OFFSET %s
    """
    params.extend([page_size, offset])
    images = execute_query(query_sql, params)

    return {
        "images": images, "total": total, "page": page,
        "page_size": page_size, "total_pages": (total + page_size - 1) // page_size
    }


@router.post("/folders/scan")
async def scan_folder(req: FolderScanRequest):
    """扫描并索引指定文件夹"""
    result = index_folder(req.folder_path)
    return result


@router.post("/folders/scan-all")
async def scan_all():
    """启动后台扫描所有文件夹（异步，立即返回 task_id）"""
    task_id = uuid.uuid4().hex[:12]
    folders = scan_folders()
    total = len(folders)

    with _scan_lock:
        _scan_tasks[task_id] = {
            "status": "running",
            "progress": {"current": 0, "total": total, "current_folder": "", "added": 0, "skipped": 0},
            "started_at": time.time()
        }

    def _run():
        total_added = 0
        total_skipped = 0
        for i, folder in enumerate(folders):
            with _scan_lock:
                if task_id not in _scan_tasks:
                    return
                _scan_tasks[task_id]["progress"].update({
                    "current": i + 1, "current_folder": folder["name"],
                })
            try:
                result = index_folder(folder["path"])
                total_added += result["added"]
                total_skipped += result["skipped"]
                with _scan_lock:
                    if task_id in _scan_tasks:
                        _scan_tasks[task_id]["progress"].update({
                            "added": total_added, "skipped": total_skipped
                        })
            except Exception as e:
                print(f"Scan error on {folder['name']}: {e}")
        with _scan_lock:
            if task_id in _scan_tasks:
                _scan_tasks[task_id]["status"] = "completed"
                _scan_tasks[task_id]["result"] = {"added": total_added, "skipped": total_skipped}

    t = threading.Thread(target=_run, daemon=True)
    t.start()

    return {"task_id": task_id, "total_folders": total}


@router.get("/folders/scan-all/progress")
async def scan_all_progress(task_id: str = Query(...)):
    """查询扫描进度"""
    with _scan_lock:
        task = _scan_tasks.get(task_id)
    if not task:
        return {"status": "not_found"}
    result = {"status": task["status"], "progress": dict(task.get("progress", {}))}
    if task["status"] == "completed":
        result["result"] = task.get("result", {})
        elapsed = time.time() - task.get("started_at", 0)
        if elapsed > 300:
            with _scan_lock:
                _scan_tasks.pop(task_id, None)
    return result
