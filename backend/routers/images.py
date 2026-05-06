"""
图片 API — 批量查询、单张详情、缩略图、代理、搜索、应用状态
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from PIL import Image as PILImage, ImageOps

from database import execute_query
from config import PHOTO_ROOT

router = APIRouter(prefix="/api", tags=["images"])


@router.get("/images/batch")
async def get_images_batch(ids: str = Query(..., description="逗号分隔的图片ID列表")):
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
    import urllib.parse, hashlib
    from pathlib import Path

    decoded_path = urllib.parse.unquote(path)
    image_path = Path(decoded_path)
    root = Path(PHOTO_ROOT)

    if not str(image_path).startswith(str(root)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    cache_dir = Path(r"D:\MySoftware\photo-manager\thumbnail_cache")
    cache_dir.mkdir(exist_ok=True)

    path_hash = hashlib.md5(str(image_path).encode()).hexdigest()
    cache_file = cache_dir / f"{path_hash}_{size}.jpg"

    if not cache_file.exists():
        try:
            with PILImage.open(image_path) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail((size, size), PILImage.LANCZOS)
                img.save(cache_file, 'JPEG', quality=85, optimize=True)
        except Exception:
            return FileResponse(decoded_path)

    return FileResponse(str(cache_file))


@router.get("/image/proxy/{path:path}")
async def proxy_image(path: str):
    """代理图片访问"""
    import urllib.parse
    from pathlib import Path

    decoded_path = urllib.parse.unquote(path)
    image_path = Path(decoded_path)
    root = Path(PHOTO_ROOT)

    if not str(image_path).startswith(str(root)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    return FileResponse(decoded_path)


@router.get("/search")
async def search_images(
    keyword: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100)
):
    """全局搜索图片"""
    pattern = f"%{keyword}%"
    count_sql = """
        SELECT COUNT(*) as total FROM images i
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
    return {"images": images, "total": total, "page": page, "page_size": page_size}


class AppStateUpdate(BaseModel):
    last_folder_path: Optional[str] = None
    last_page: Optional[int] = None
    last_sort_by: Optional[str] = None
    last_sort_order: Optional[str] = None
    last_scroll_top: Optional[int] = None


@router.get("/app-state")
async def get_app_state():
    """获取应用状态"""
    result = execute_query(
        "SELECT last_folder_path, last_page, last_sort_by, last_sort_order, last_scroll_top, updated_at FROM app_state WHERE id = 1"
    )
    if result:
        return result[0]
    return {"last_folder_path": None, "last_page": 1, "last_sort_by": "filename", "last_sort_order": "asc", "last_scroll_top": 0}


@router.post("/app-state")
async def update_app_state(state: AppStateUpdate):
    """更新应用状态"""
    fields = []
    params = []
    for col, val in [
        ("last_folder_path", state.last_folder_path),
        ("last_page", state.last_page),
        ("last_sort_by", state.last_sort_by),
        ("last_sort_order", state.last_sort_order),
        ("last_scroll_top", state.last_scroll_top),
    ]:
        if val is not None:
            fields.append(f"{col} = %s")
            params.append(val)
    if fields:
        execute_query(f"UPDATE app_state SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
                      tuple(params), fetch=False)
    return {"success": True}
