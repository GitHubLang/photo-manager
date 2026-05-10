import os
import re
from fastapi import APIRouter
from fastapi.responses import FileResponse
import database

router = APIRouter(prefix='/api/bgm', tags=['bgm'])

SUPPORTED_EXT = {'.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'}


def get_bgm_dir():
    """Get the configured local BGM directory from settings."""
    db = database.get_connection()
    cur = db.cursor(dictionary=True)
    cur.execute("SELECT `value` FROM user_settings WHERE `key` = 'bgm_local_dir'")
    row = cur.fetchone()
    cur.close()
    db.close()
    if row:
        return row['value']
    return ''


@router.get('/local')
def list_local_bgm():
    """List all music files in the configured local BGM directory."""
    bgm_dir = get_bgm_dir()
    if not bgm_dir or not os.path.isdir(bgm_dir):
        return {'enabled': False, 'tracks': []}

    tracks = []
    try:
        for fname in sorted(os.listdir(bgm_dir)):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in SUPPORTED_EXT:
                continue
            filepath = os.path.join(bgm_dir, fname)
            if not os.path.isfile(filepath):
                continue
            size = os.path.getsize(filepath)
            # Parse title from filename (strip extension)
            title = os.path.splitext(fname)[0]
            tracks.append({
                'filename': fname,
                'title': title,
                'artist': '',
                'size': size,
            })
    except PermissionError:
        pass

    return {
        'enabled': True,
        'tracks': tracks,
        'proxy_prefix': '/api/bgm/local/',
        'dir': bgm_dir,
    }


@router.get('/local/{filename:path}')
def serve_local_bgm(filename: str):
    """Serve a local music file."""
    # Prevent directory traversal
    if '..' in filename or filename.startswith('/'):
        from fastapi.responses import JSONResponse
        return JSONResponse({'error': 'invalid path'}, status_code=400)

    bgm_dir = get_bgm_dir()
    if not bgm_dir:
        from fastapi.responses import JSONResponse
        return JSONResponse({'error': 'no local bgm dir configured'}, status_code=404)

    filepath = os.path.join(bgm_dir, filename)
    # Security: ensure resolved path is under bgm_dir
    resolved = os.path.realpath(filepath)
    if not resolved.startswith(os.path.realpath(bgm_dir)):
        from fastapi.responses import JSONResponse
        return JSONResponse({'error': 'access denied'}, status_code=403)

    if not os.path.isfile(resolved):
        from fastapi.responses import JSONResponse
        return JSONResponse({'error': 'file not found'}, status_code=404)

    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.flac': 'audio/flac',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
    }
    return FileResponse(resolved, media_type=media_types.get(ext, 'application/octet-stream'))
