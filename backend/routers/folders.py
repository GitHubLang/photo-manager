"""
文件夹 + 图片列表 + 扫描 API
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
import threading
import time
import uuid

from db import DB
from services.image_scanner import scan_folders, index_folder

router = APIRouter(prefix="/api", tags=["folders"])

# 后台扫描任务状态
_scan_tasks = {}
_scan_lock = threading.Lock()

# 目录树缓存（30s TTL）
_folder_tree_cache = {"data": None, "timestamp": 0}
_folder_tree_lock = threading.Lock()


class FolderScanRequest(BaseModel):
    folder_path: str


@router.get("/folders")
async def get_folders():
    """获取目录树（缓存 30s）"""
    global _folder_tree_cache
    now = time.time()
    # 缓存命中
    with _folder_tree_lock:
        if _folder_tree_cache["data"] and (now - _folder_tree_cache["timestamp"]) < 30:
            return {"folders": _folder_tree_cache["data"]}
    # 缓存未命中，重新扫描
    folders = scan_folders()
    with _folder_tree_lock:
        _folder_tree_cache = {"data": folders, "timestamp": now}
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

    total = DB.images_count_by_folder(folder_path, min_score=min_score, search=search)
    images = DB.images_get_by_folder(
        folder_path, page, page_size,
        sort_by=sort_by, sort_order=sort_order,
        min_score=min_score, search=search)

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
    """启动后台扫描所有根目录（递归，异步，立即返回 task_id）"""
    import os
    task_id = uuid.uuid4().hex[:12]
    # 直接从数据库获取根目录列表
    from services.image_scanner import _get_photo_roots
    roots = _get_photo_roots()
    total = len(roots)

    with _scan_lock:
        _scan_tasks[task_id] = {
            "status": "running",
            "progress": {"current": 0, "total": total, "current_folder": "", "added": 0, "skipped": 0},
            "started_at": time.time()
        }

    def _run():
        total_added = 0
        total_skipped = 0
        for i, root_path in enumerate(roots):
            with _scan_lock:
                if task_id not in _scan_tasks:
                    return
                root_name = os.path.basename(root_path) or root_path
                _scan_tasks[task_id]["progress"].update({
                    "current": i + 1, "current_folder": root_name,
                })
            try:
                result = index_folder(root_path)
                total_added += result["added"]
                total_skipped += result["skipped"]
                with _scan_lock:
                    if task_id in _scan_tasks:
                        _scan_tasks[task_id]["progress"].update({
                            "added": total_added, "skipped": total_skipped
                        })
            except Exception as e:
                print(f"Scan error on {root_path}: {e}")
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
