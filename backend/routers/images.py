"""
图片相关 API
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
from PIL import Image as PILImage, ImageOps

from database import execute_query
from services.image_scanner import scan_folders, index_folder, scan_folder_images
from services.llm_scorer import score_and_describe_image
from config import PHOTO_ROOT
import threading

# 并发限制：最多同时处理3个评分任务
score_semaphore = threading.Semaphore(3)

router = APIRouter(prefix="/api", tags=["images"])


class ScoreRequest(BaseModel):
    image_ids: List[int]
    model: str = "local"


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
    # 修复路径分隔符（URL 中的 / 转为 \\）
    folder_path = folder_path.replace('/', '\\')
    
    # 构建查询
    where_clauses = ["i.folder_path = %s"]
    params = [folder_path]
    
    if min_score is not None:
        where_clauses.append("s.total_score >= %s")
        params.append(min_score)
    
    if search:
        where_clauses.append("(i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s)")
        search_pattern = f"%{search}%"
        params.extend([search_pattern, search_pattern, search_pattern])
    
    where_sql = " AND ".join(where_clauses)
    sort_column = {
        "filename": "i.filename",
        "total_score": "s.total_score",
        "file_size": "i.file_size",
        "created_at": "i.created_at"
    }.get(sort_by, "i.filename")
    sort_dir = "DESC" if sort_order == "desc" else "ASC"
    
    # 获取总数
    count_sql = f"""
        SELECT COUNT(*) as total 
        FROM images i 
        LEFT JOIN image_scores s ON i.id = s.image_id
        LEFT JOIN image_descriptions d ON i.id = d.image_id
        WHERE {where_sql}
    """
    total = execute_query(count_sql, params)[0]['total']
    
    # 获取分页数据 - 获取每张图片的最新评分
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
        "images": images,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }


@router.get("/images/batch")
async def get_images_batch(
    ids: str = Query(..., description="逗号分隔的图片ID列表")
):
    """批量获取图片信息"""
    id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
    if not id_list:
        return {"images": []}
    placeholders = ','.join(['%s'] * len(id_list))
    images = execute_query(
        f"""
        SELECT i.id, i.filename, i.file_path, i.width, i.height, i.file_size,
               s.total_score, d.description, d.tags
        FROM images i
        LEFT JOIN image_scores s ON s.id = (
            SELECT id FROM image_scores WHERE image_id = i.id ORDER BY scored_at DESC LIMIT 1
        )
        LEFT JOIN image_descriptions d ON d.id = (
            SELECT id FROM image_descriptions WHERE image_id = i.id ORDER BY created_at DESC LIMIT 1
        )
        WHERE i.id IN ({placeholders})
        """,
        tuple(id_list)
    )
    return {"images": images}


@router.get("/images/{image_id}")
async def get_image(image_id: int):
    """获取单张图片详情"""
    image = execute_query("""
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
        LEFT JOIN image_scores s ON i.id = s.image_id
        LEFT JOIN image_descriptions d ON i.id = d.image_id
        WHERE i.id = %s
    """, (image_id,))
    
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    
    return image[0]


@router.get("/image/thumbnail/{path:path}")
async def thumbnail_image(path: str, size: int = Query(400, ge=100, le=1200)):
    """生成并缓存缩略图"""
    import urllib.parse
    import hashlib
    decoded_path = urllib.parse.unquote(path)
    
    # 安全检查
    from pathlib import Path
    image_path = Path(decoded_path)
    root = Path(PHOTO_ROOT)
    
    if not str(image_path).startswith(str(root)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    # 生成缩略图缓存路径
    cache_dir = Path(r"D:\MySoftware\photo-manager\thumbnail_cache")
    cache_dir.mkdir(exist_ok=True)
    
    # 用原图路径的hash作为缓存文件名
    path_hash = hashlib.md5(str(image_path).encode()).hexdigest()
    cache_file = cache_dir / f"{path_hash}_{size}.jpg"
    
    # 如果缓存不存在，生成缩略图
    if not cache_file.exists():
        try:
            with PILImage.open(image_path) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail((size, size), PILImage.LANCZOS)
                img.save(cache_file, 'JPEG', quality=85, optimize=True)
        except Exception as e:
            # 如果缩略图生成失败，返回原图
            return FileResponse(decoded_path)
    
    return FileResponse(str(cache_file))


@router.get("/image/proxy/{path:path}")
async def proxy_image(path: str):
    """代理图片访问，防止路径泄露"""
    import urllib.parse
    decoded_path = urllib.parse.unquote(path)
    
    # 安全检查：确保路径在允许的目录下
    from pathlib import Path
    image_path = Path(decoded_path)
    root = Path(PHOTO_ROOT)
    
    if not str(image_path).startswith(str(root)):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(decoded_path)


@router.post("/folders/scan")
async def scan_new_folder(req: FolderScanRequest):
    """扫描并索引指定文件夹"""
    result = index_folder(req.folder_path)
    return result


@router.post("/folders/scan-all")
async def scan_all():
    """扫描并索引所有文件夹"""
    from services.image_scanner import index_all_folders
    result = index_all_folders()
    return result


@router.post("/images/score")
async def score_images(req: ScoreRequest):
    """创建评分任务（异步，不等待结果）"""
    from datetime import datetime
    import threading
    
    task_ids = []
    
    for image_id in req.image_ids:
        # 检查图片是否存在
        image_data = execute_query(
            "SELECT id, file_path FROM images WHERE id = %s",
            (image_id,)
        )
        if not image_data:
            continue
        
        # 创建任务记录
        task_id = execute_query(
            """INSERT INTO score_tasks (image_id, status, model) 
               VALUES (%s, 'pending', %s)""",
            (image_id, req.model),
            fetch=False
        )
        task_ids.append({"image_id": image_id, "task_id": task_id})
    
    # 为每个任务启动一个worker线程（最多3个并发，由信号量控制）
    for tid in task_ids:
        def process_one(task_id: int, image_id: int, model: str):
            from database import get_connection
            from services.llm_scorer import score_and_describe_image
            
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            try:
                # 直接根据task_id更新（不需要抢任务）
                cursor.execute(
                    """UPDATE score_tasks SET status = 'processing' 
                       WHERE id = %s AND status = 'pending'""",
                    (task_id,)
                )
                conn.commit()
                if cursor.rowcount == 0:
                    return  # 任务不存在或已被处理
                
                # 获取图片路径
                cursor.execute("SELECT file_path FROM images WHERE id = %s", (image_id,))
                img = cursor.fetchone()
                if not img:
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'failed', error_message = 'Image not found' WHERE id = %s",
                        (task_id,)
                    )
                    conn.commit()
                    return
                
                # 信号量控制LLM并发数
                score_semaphore.acquire()
                try:
                    result = score_and_describe_image(image_id, img['file_path'], model)
                    if result.get('scored') or result.get('described'):
                        cursor.execute(
                            """UPDATE score_tasks SET status = 'completed', 
                               completed_at = NOW() WHERE id = %s""",
                            (task_id,)
                        )
                    else:
                        cursor.execute(
                            """UPDATE score_tasks SET status = 'failed', 
                               error_message = 'LLM call failed' WHERE id = %s""",
                            (task_id,)
                        )
                except Exception as e:
                    cursor.execute(
                        """UPDATE score_tasks SET status = 'failed', 
                           error_message = %s WHERE id = %s""",
                        (str(e), task_id)
                    )
                finally:
                    score_semaphore.release()
                
                conn.commit()
            finally:
                cursor.close()
                conn.close()
        
        t = threading.Thread(target=process_one, args=(tid['task_id'], tid['image_id'], req.model), daemon=True)
        t.start()
    
    return {"message": "评分任务已创建", "tasks": task_ids}


@router.get("/images/score/status/{image_id}")
async def get_score_status(image_id: int):
    """获取图片评分状态"""
    result = execute_query(
        """SELECT status, error_message, completed_at 
           FROM score_tasks WHERE image_id = %s 
           ORDER BY id DESC LIMIT 1""",
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


@router.get("/search")
async def search_images(
    keyword: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """全局搜索图片"""
    pattern = f"%{keyword}%"
    
    count_sql = """
        SELECT COUNT(*) as total 
        FROM images i 
        LEFT JOIN image_scores s ON i.id = s.image_id
        LEFT JOIN image_descriptions d ON i.id = d.image_id
        WHERE i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s
    """
    total = execute_query(count_sql, (pattern, pattern, pattern))[0]['total']
    
    offset = (page - 1) * page_size
    query_sql = """
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
        WHERE i.filename LIKE %s OR d.description LIKE %s OR d.tags LIKE %s
        ORDER BY s.total_score DESC
        LIMIT %s OFFSET %s
    """
    images = execute_query(query_sql, (pattern, pattern, pattern, page_size, offset))
    
    return {
        "images": images,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/app-state")
async def get_app_state():
    """获取应用状态（如上次浏览位置）"""
    result = execute_query("SELECT last_folder_path, last_page, last_sort_by, last_sort_order, last_scroll_top, updated_at FROM app_state WHERE id = 1")
    if result:
        return result[0]
    return {"last_folder_path": None, "last_page": 1, "last_sort_by": "filename", "last_sort_order": "asc", "last_scroll_top": 0}


class AppStateUpdate(BaseModel):
    last_folder_path: Optional[str] = None
    last_page: Optional[int] = None
    last_sort_by: Optional[str] = None
    last_sort_order: Optional[str] = None
    last_scroll_top: Optional[int] = None


@router.post("/app-state")
async def update_app_state(state: AppStateUpdate):
    """更新应用状态"""
    fields = []
    params = []
    if state.last_folder_path is not None:
        fields.append("last_folder_path = %s")
        params.append(state.last_folder_path)
    if state.last_page is not None:
        fields.append("last_page = %s")
        params.append(state.last_page)
    if state.last_sort_by is not None:
        fields.append("last_sort_by = %s")
        params.append(state.last_sort_by)
    if state.last_sort_order is not None:
        fields.append("last_sort_order = %s")
        params.append(state.last_sort_order)
    if state.last_scroll_top is not None:
        fields.append("last_scroll_top = %s")
        params.append(state.last_scroll_top)
    if fields:
        execute_query(
            f"UPDATE app_state SET {', '.join(fields)} WHERE id = 1",
            tuple(params),
            fetch=False
        )
    return {"success": True}


@router.get("/score-tasks")
async def get_score_tasks(
    status: Optional[str] = Query(None, enum=["pending", "processing", "completed", "failed"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """获取评分任务列表，支持按状态筛选"""
    where_sql = "WHERE 1=1"
    params = []
    
    if status:
        where_sql += " AND t.status = %s"
        params.append(status)
    
    # 获取总数
    count_sql = f"SELECT COUNT(*) as total FROM score_tasks t {where_sql}"
    total = execute_query(count_sql, params)[0]['total']
    
    # 获取分页数据
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
    
    return {
        "tasks": tasks,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/score-tasks/retry")
async def retry_score_tasks(image_ids: List[int]):
    """重新评分指定图片，成功后把所有该图片的任务都标记为completed"""
    task_ids = []
    for image_id in image_ids:
        # 把该图片所有非completed的任务先标记为pending（重置）
        execute_query(
            """UPDATE score_tasks SET status = 'pending', error_message = NULL 
               WHERE image_id = %s AND status IN ('failed', 'processing')""",
            (image_id,),
            fetch=False
        )
        # 如果没有需要重置的（非failed/processing），则创建新任务
        existing = execute_query(
            "SELECT id FROM score_tasks WHERE image_id = %s AND status = 'pending'",
            (image_id,)
        )
        if not existing:
            # 全是completed，说明之前已成功，直接跳过（不允许重跑成功的）
            continue
        task_id = existing[0]['id']
        task_ids.append({"image_id": image_id, "task_id": task_id})
    
    if not task_ids:
        return {"success": False, "error": "所选图片已完成评分，无法重跑"}
    
    # 为每个任务启动一个worker线程
    for tid in task_ids:
        def process_one(task_id: int, image_id: int):
            from database import get_connection
            from services.llm_scorer import score_and_describe_image
            
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            try:
                # 直接根据task_id更新
                cursor.execute(
                    """UPDATE score_tasks SET status = 'processing' 
                       WHERE id = %s AND status = 'pending'""",
                    (task_id,)
                )
                conn.commit()
                if cursor.rowcount == 0:
                    return
                
                cursor.execute("SELECT file_path FROM images WHERE id = %s", (image_id,))
                img = cursor.fetchone()
                if not img:
                    cursor.execute(
                        "UPDATE score_tasks SET status = 'failed', error_message = 'Image not found' WHERE id = %s",
                        (task_id,)
                    )
                    conn.commit()
                    return
                
                score_semaphore.acquire()
                try:
                    # 先获取model
                    cursor.execute("SELECT model FROM score_tasks WHERE id = %s", (task_id,))
                    task = cursor.fetchone()
                    model = task['model'] if task else 'local'
                    result = score_and_describe_image(image_id, img['file_path'], model)
                    if result.get('scored') or result.get('described'):
                        cursor.execute(
                            """UPDATE score_tasks SET status = 'completed', 
                               completed_at = NOW() WHERE image_id = %s""",
                            (image_id,)
                        )
                    else:
                        cursor.execute(
                            """UPDATE score_tasks SET status = 'failed', 
                               error_message = 'LLM call failed' WHERE id = %s""",
                            (task_id,)
                        )
                except Exception as e:
                    cursor.execute(
                        """UPDATE score_tasks SET status = 'failed', 
                           error_message = %s WHERE id = %s""",
                        (str(e), task_id)
                    )
                finally:
                    score_semaphore.release()
                
                conn.commit()
            finally:
                cursor.close()
                conn.close()
        
        t = threading.Thread(target=process_one, args=(tid['task_id'], tid['image_id']), daemon=True)
        t.start()
    
    return {"success": True, "tasks": task_ids}
