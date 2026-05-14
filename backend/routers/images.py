"""
图片 API — 批量查询、单张详情、缩略图、代理、搜索、应用状态
"""
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from PIL import Image as PILImage, ImageOps

from db import DB
from config import PHOTO_ROOT


def _get_photo_roots():
    """从数据库获取所有启用的照片根目录"""
    from database import execute_query
    try:
        rows = execute_query("SELECT path FROM photo_directories WHERE is_active = 1")
        return [row['path'] for row in rows]
    except:
        return [PHOTO_ROOT]

router = APIRouter(prefix="/api", tags=["images"])


@router.get("/images/batch")
async def get_images_batch(ids: str = Query(..., description="逗号分隔的图片ID列表")):
    """批量获取图片信息"""
    id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
    if not id_list:
        return {"images": []}
    placeholders = ','.join(['%s'] * len(id_list))
    images = DB.images_get_by_ids(id_list)
    return {"images": images}


@router.get("/images/{image_id}")
async def get_image(image_id: int):
    """获取单张图片详情"""
    image = DB.images_get_detail(image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.get("/image/thumbnail/{path:path}")
async def thumbnail_image(path: str, size: int = Query(400, ge=100, le=1200)):
    """生成并缓存缩略图"""
    import urllib.parse, hashlib
    from pathlib import Path

    decoded_path = urllib.parse.unquote(path)
    image_path = Path(decoded_path)
    roots = _get_photo_roots()

    allowed = any(str(image_path).startswith(str(Path(r))) for r in roots)
    if not allowed:
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
    roots = _get_photo_roots()

    allowed = any(str(image_path).startswith(str(Path(r))) for r in roots)
    if not allowed:
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
    total, images = DB.images_search(keyword, page, page_size)
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
    return DB.app_state_get()


@router.post("/app-state")
async def update_app_state(state: AppStateUpdate):
    """更新应用状态"""
    fields = []
    for col, val in [
        ("last_folder_path", state.last_folder_path),
        ("last_page", state.last_page),
        ("last_sort_by", state.last_sort_by),
        ("last_sort_order", state.last_sort_order),
        ("last_scroll_top", state.last_scroll_top),
    ]:
        if val is not None:
            fields.append((col, val))
    if fields:
        DB.app_state_update(fields)
    return {"success": True}
