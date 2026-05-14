from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import os

from database import execute_query

router = APIRouter(prefix='/api', tags=['settings'])


class SettingsRequest(BaseModel):
    scoring_model: str = ''
    caption_model: str = ''
    caption_llm_model: str = ''
    bgm_local_dir: str = ''


@router.get('/settings')
def get_settings():
    db = None
    try:
        import database
        db = database.get_connection()
        cur = db.cursor(dictionary=True)
        cur.execute('SELECT `key`, `value` FROM user_settings')
        rows = cur.fetchall()
        cur.close()
        data = {r['key']: r['value'] for r in rows}
        return {
            'scoring_model': data.get('scoring_model', ''),
            'caption_model': data.get('caption_model', ''),
            'caption_llm_model': data.get('caption_llm_model', ''),
            'bgm_local_dir': data.get('bgm_local_dir', ''),
        }
    finally:
        if db:
            db.close()


@router.post('/settings')
def save_settings(req: SettingsRequest):
    db = None
    try:
        import database
        db = database.get_connection()
        cur = db.cursor()
        for key, val in [
            ('scoring_model', req.scoring_model),
            ('caption_model', req.caption_model),
            ('caption_llm_model', req.caption_llm_model),
            ('bgm_local_dir', req.bgm_local_dir)
        ]:
            cur.execute(
                'INSERT INTO user_settings (`key`, `value`) VALUES (%s, %s) '
                'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
                (key, val)
            )
        db.commit()
        cur.close()
        return {'status': 'ok'}
    finally:
        if db:
            db.close()


# ==================== 照片目录 CRUD API ====================

class PhotoDirectoryCreate(BaseModel):
    name: str
    path: Optional[str] = ''
    parent_id: Optional[int] = None
    is_virtual: bool = False


class PhotoDirectoryUpdate(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None
    parent_id: Optional[int] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class DirectoryImageAssign(BaseModel):
    image_ids: List[int]


def build_dir_dict(r):
    """将 DB 行转为 API 返回格式"""
    return {
        "id": r['id'],
        "name": r['name'],
        "path": r['path'] or '',
        "is_virtual": bool(r['is_virtual']),
        "parent_id": r['parent_id'],
        "is_active": bool(r['is_active']),
        "image_count": r['image_count'] or 0,
        "folder_date": str(r['folder_date']) if r['folder_date'] else None,
        "sort_order": r['sort_order'] or 0,
        "created_at": str(r['created_at']) if r['created_at'] else None,
        "updated_at": str(r['updated_at']) if r['updated_at'] else None,
    }


@router.get('/photo-directories')
def list_photo_directories():
    """列出所有目录（含虚拟目录）"""
    rows = execute_query(
        "SELECT * FROM photo_directories ORDER BY sort_order, name"
    )
    return {"directories": [build_dir_dict(r) for r in rows]}


@router.post('/photo-directories')
def create_photo_directory(req: PhotoDirectoryCreate):
    """创建目录（真实或虚拟）"""
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="目录名称不能为空")

    path = req.path.strip().rstrip('\\').rstrip('/') if req.path else ''

    # 虚拟目录不需要路径
    if not req.is_virtual:
        if not path:
            raise HTTPException(status_code=400, detail="真实目录必须填写路径")
        if not os.path.isdir(path):
            raise HTTPException(status_code=400, detail=f"目录不存在: {path}")

    try:
        if path:
            execute_query(
                "INSERT INTO photo_directories (name, path, parent_id, is_virtual, is_active) "
                "VALUES (%s, %s, %s, %s, 1)",
                (name, path, req.parent_id, 1 if req.is_virtual else 0),
                fetch=False
            )
        else:
            execute_query(
                "INSERT INTO photo_directories (name, parent_id, is_virtual, is_active) "
                "VALUES (%s, %s, %s, 1)",
                (name, req.parent_id, 1 if req.is_virtual else 0),
                fetch=False
            )
    except Exception as e:
        if "Duplicate" in str(e):
            raise HTTPException(status_code=400, detail=f"路径已存在: {path}")
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")

    # 返回新创建的记录
    if path:
        rows = execute_query("SELECT * FROM photo_directories WHERE path = %s", (path,))
    else:
        rows = execute_query("SELECT * FROM photo_directories ORDER BY id DESC LIMIT 1")
    if rows:
        return {"status": "ok", "directory": build_dir_dict(rows[0])}
    return {"status": "ok"}


@router.put('/photo-directories/{dir_id}')
def update_photo_directory(dir_id: int, req: PhotoDirectoryUpdate):
    """更新目录信息（名称、路径、状态等）"""
    # 检查是否存在
    rows = execute_query("SELECT * FROM photo_directories WHERE id = %s", (dir_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="目录不存在")

    updates = []
    params = []
    if req.name is not None:
        updates.append("name = %s")
        params.append(req.name.strip())
    if req.path is not None:
        p = req.path.strip().rstrip('\\').rstrip('/')
        updates.append("path = %s")
        params.append(p)
    if req.parent_id is not None:
        updates.append("parent_id = %s")
        params.append(req.parent_id)
    if req.is_active is not None:
        updates.append("is_active = %s")
        params.append(1 if req.is_active else 0)
    if req.sort_order is not None:
        updates.append("sort_order = %s")
        params.append(req.sort_order)

    if not updates:
        return {"status": "ok", "directory": build_dir_dict(rows[0])}

    params.append(dir_id)
    sql = f"UPDATE photo_directories SET {', '.join(updates)} WHERE id = %s"
    execute_query(sql, params, fetch=False)

    rows = execute_query("SELECT * FROM photo_directories WHERE id = %s", (dir_id,))
    return {"status": "ok", "directory": build_dir_dict(rows[0])}


@router.delete('/photo-directories/{dir_id}')
def delete_photo_directory(dir_id: int):
    """删除目录（仅 DB，不影响文件系统）"""
    execute_query("DELETE FROM photo_directories WHERE id = %s", (dir_id,), fetch=False)
    return {"status": "ok"}


@router.post('/photo-directories/{dir_id}/toggle')
def toggle_photo_directory(dir_id: int):
    """切换启用/禁用"""
    rows = execute_query("SELECT is_active FROM photo_directories WHERE id = %s", (dir_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="目录不存在")
    new_status = 0 if rows[0]['is_active'] else 1
    execute_query(
        "UPDATE photo_directories SET is_active = %s WHERE id = %s",
        (new_status, dir_id), fetch=False
    )
    return {"status": "ok", "is_active": bool(new_status)}


@router.post('/photo-directories/{dir_id}/scan')
def scan_photo_directory(dir_id: int):
    """扫描真实目录：同步目录树 + 索引图片 + 更新计数"""
    from services.image_scanner import scan_root_directory
    rows = execute_query("SELECT * FROM photo_directories WHERE id = %s", (dir_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="目录不存在")
    r = rows[0]
    if r['is_virtual'] or not r['path']:
        raise HTTPException(status_code=400, detail="虚拟目录不支持文件系统扫描")
    result = scan_root_directory(r['id'], r['path'])
    return {"status": "ok", "result": result}


# ==================== 目录图片管理（虚拟目录用）====================

@router.get('/photo-directories/{dir_id}/images')
def list_directory_images(dir_id: int):
    """获取目录下关联的图片列表（含虚拟目录的手动关联）"""
    # 先查该目录的 path 下的图片（from images table）
    rows = execute_query("SELECT * FROM photo_directories WHERE id = %s", (dir_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="目录不存在")
    r = rows[0]

    image_ids = []
    if r['path']:
        # 真实目录：从 images 表查
        path_images = execute_query(
            "SELECT id, file_path, filename FROM images WHERE folder_path = %s AND is_deleted = 0 ORDER BY filename",
            (r['path'],)
        )
        image_ids = [img['id'] for img in path_images]
    else:
        # 虚拟目录：从 directory_images 表查
        mapped = execute_query(
            "SELECT di.image_id, i.file_path, i.filename FROM directory_images di "
            "JOIN images i ON di.image_id = i.id "
            "WHERE di.directory_id = %s ORDER BY di.sort_order, i.filename",
            (dir_id,)
        )
        image_ids = [img['image_id'] for img in mapped]

    return {"directory_id": dir_id, "image_ids": image_ids}


@router.post('/photo-directories/{dir_id}/images')
def assign_images_to_directory(dir_id: int, req: DirectoryImageAssign):
    """为虚拟目录手动关联图片"""
    rows = execute_query("SELECT * FROM photo_directories WHERE id = %s", (dir_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="目录不存在")

    for img_id in req.image_ids:
        try:
            execute_query(
                "INSERT IGNORE INTO directory_images (directory_id, image_id) VALUES (%s, %s)",
                (dir_id, img_id), fetch=False
            )
        except:
            pass

    # 更新 image_count
    cnt = execute_query(
        "SELECT COUNT(*) as cnt FROM directory_images WHERE directory_id = %s",
        (dir_id,)
    )[0]['cnt']
    execute_query(
        "UPDATE photo_directories SET image_count = %s WHERE id = %s",
        (cnt, dir_id), fetch=False
    )

    return {"status": "ok", "image_count": cnt}


@router.delete('/photo-directories/{dir_id}/images')
def remove_images_from_directory(dir_id: int, req: DirectoryImageAssign):
    """移除虚拟目录中的图片关联"""
    for img_id in req.image_ids:
        execute_query(
            "DELETE FROM directory_images WHERE directory_id = %s AND image_id = %s",
            (dir_id, img_id), fetch=False
        )
    return {"status": "ok"}
