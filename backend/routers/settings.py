from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List
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


# ==================== 照片目录管理 API ====================

class PhotoDirectoryAddRequest(BaseModel):
    path: str


@router.get('/photo-directories')
def list_photo_directories():
    """列出所有已配置的照片根目录"""
    rows = execute_query(
        "SELECT id, path, is_active, created_at FROM photo_directories ORDER BY id"
    )
    directories = []
    for r in rows:
        exists = os.path.isdir(r['path'])
        directories.append({
            "id": r['id'],
            "path": r['path'],
            "is_active": bool(r['is_active']),
            "exists": exists,
            "created_at": str(r['created_at']) if r['created_at'] else None
        })
    return {"directories": directories}


@router.post('/photo-directories')
def add_photo_directory(req: PhotoDirectoryAddRequest):
    """添加新的照片根目录"""
    path = req.path.strip().rstrip('\\').rstrip('/')
    if not path:
        raise HTTPException(status_code=400, detail="目录路径不能为空")

    if not os.path.isdir(path):
        raise HTTPException(status_code=400, detail=f"目录不存在: {path}")

    try:
        execute_query(
            "INSERT INTO photo_directories (path) VALUES (%s)",
            (path,), fetch=False
        )
    except Exception as e:
        # Duplicate entry
        if "Duplicate" in str(e):
            raise HTTPException(status_code=400, detail="该目录已存在")
        raise HTTPException(status_code=500, detail=f"添加失败: {str(e)}")

    return {"status": "ok", "path": path}


@router.delete('/photo-directories/{dir_id}')
def delete_photo_directory(dir_id: int):
    """删除照片根目录"""
    execute_query(
        "DELETE FROM photo_directories WHERE id = %s",
        (dir_id,), fetch=False
    )
    return {"status": "ok"}


@router.post('/photo-directories/{dir_id}/toggle')
def toggle_photo_directory(dir_id: int):
    """切换目录启用/禁用状态"""
    rows = execute_query(
        "SELECT is_active FROM photo_directories WHERE id = %s",
        (dir_id,)
    )
    if not rows:
        raise HTTPException(status_code=404, detail="目录不存在")

    new_status = 0 if rows[0]['is_active'] else 1
    execute_query(
        "UPDATE photo_directories SET is_active = %s WHERE id = %s",
        (new_status, dir_id), fetch=False
    )
    return {"status": "ok", "is_active": bool(new_status)}
