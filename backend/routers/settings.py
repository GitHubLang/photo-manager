from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict
import database

router = APIRouter(prefix='/api', tags=['settings'])


class SettingsRequest(BaseModel):
    scoring_model: str = ''
    caption_model: str = ''


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
    }


@router.post('/settings')
def save_settings(req: SettingsRequest):
    db = database.get_connection()
    cur = db.cursor()
    for key, val in [('scoring_model', req.scoring_model), ('caption_model', req.caption_model)]:
        cur.execute(
            'INSERT INTO user_settings (`key`, `value`) VALUES (%s, %s) '
            'ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
            (key, val)
        )
    db.commit()
    cur.close()
    db.close()
    return {'status': 'ok'}
