from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
import database

router = APIRouter(prefix='/api', tags=['settings'])


class SettingsRequest(BaseModel):
    scoring_model: str = ''
    caption_model: str = ''
    caption_llm_model: str = ''
    bgm_local_dir: str = ''


@router.get('/settings')
def get_settings():
    db = database.get_connection()
    cur = db.cursor(dictionary=True)
    cur.execute('SELECT `key`, `value` FROM user_settings')
    rows = cur.fetchall()
    cur.close()
    db.close()
    data = {r['key']: r['value'] for r in rows}
    return {
        'scoring_model': data.get('scoring_model', ''),
        'caption_model': data.get('caption_model', ''),
        'caption_llm_model': data.get('caption_llm_model', ''),
        'bgm_local_dir': data.get('bgm_local_dir', ''),
    }


@router.post('/settings')
def save_settings(req: SettingsRequest):
    db = database.get_connection()
    cur = db.cursor()
    for key, val in [('scoring_model', req.scoring_model), ('caption_model', req.caption_model), ('caption_llm_model', req.caption_llm_model), ('bgm_local_dir', req.bgm_local_dir)]:
        cur.execute(
            'INSERT INTO user_settings (`key`, `value`) VALUES (%s, %s) '
            'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
            (key, val)
        )
    db.commit()
    cur.close()
    db.close()
    return {'status': 'ok'}
