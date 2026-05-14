"""
图片扫描服务 - 扫描时更新 DB 目录树 + 计数
菜单从 DB 读取，不直接扫文件系统
"""
import os
from datetime import datetime
from typing import List, Dict, Optional
from PIL import Image as PILImage, ImageOps

from config import IMAGE_EXTENSIONS
from db import DB


def _db() -> 'database':
    """延迟导入避免循环依赖"""
    from database import execute_query
    return execute_query


def get_directory_tree() -> List[Dict]:
    """从 DB 读取目录树（菜单用，不碰文件系统）
    子节点计数向上聚合到父节点
    """
    from database import execute_query
    rows = execute_query(
        "SELECT * FROM photo_directories WHERE is_active = 1 ORDER BY sort_order, name"
    )
    # 构建 parent → children 映射
    children_map = {}
    for r in rows:
        pid = r['parent_id'] or 0
        if pid not in children_map:
            children_map[pid] = []
        children_map[pid].append(r)

    def build(parent_id=0):
        result = []
        for r in children_map.get(parent_id, []):
            children, child_total = build(r['id'])
            total_count = (r['image_count'] or 0) + child_total
            node = {
                "id": r['id'],
                "name": r['name'],
                "path": r['path'] or '',
                "is_virtual": bool(r['is_virtual']),
                "is_root": r['parent_id'] is None,
                "imageCount": total_count,
                "date": str(r['folder_date']) if r['folder_date'] else None,
                "children": children
            }
            result.append(node)
        # 按 name 倒序
        result.sort(key=lambda x: x['name'], reverse=True)
        return result, sum(n['imageCount'] for n in result)

    tree, _ = build()
    return tree


def scan_root_directory(root_id: int, root_path: str) -> Dict:
    """
    扫描一个根目录：遍历文件系统，在 photo_directories 中创建/同步子目录条目，
    索引图片，更新 image_count。
    """
    from database import execute_query
    if not os.path.isdir(root_path):
        return {"added": 0, "skipped": 0, "error": f"Directory not found: {root_path}"}

    # 先索引该目录下所有图片（递归）
    result = index_folder(root_path)

    # 同步目录树到 DB
    _sync_directory_tree(root_id, root_path)

    # 更新所有 photo_directories 的 image_count
    _update_all_image_counts()

    return result


def _sync_directory_tree(parent_id: int, dir_path: str):
    """
    递归扫描文件系统，确保 DB 中的 photo_directories 条目与实际目录同步。
    仅创建新条目，不删除已存在的（用户可能想保留）。
    """
    from database import execute_query
    try:
        items = sorted(os.scandir(dir_path), key=lambda e: e.name)
    except Exception as e:
        print(f"Error scanning {dir_path}: {e}")
        return

    for entry in items:
        if not entry.is_dir(follow_symlinks=False):
            continue

        full_path = entry.path
        name = entry.name

        # 检查是否已在 DB 中
        existing = execute_query(
            "SELECT id FROM photo_directories WHERE path = %s",
            (full_path,)
        )
        if existing:
            dir_id = existing[0]['id']
            # 更新 name
            execute_query(
                "UPDATE photo_directories SET name = %s, is_active = 1 WHERE id = %s",
                (name, dir_id), fetch=False
            )
        else:
            # 解析日期
            folder_date = None
            if '-' in name:
                try:
                    parts = name.split('-')
                    if len(parts) == 3:
                        normalized = f"{int(parts[0])}-{int(parts[1]):02d}-{int(parts[2]):02d}"
                        folder_date = datetime.strptime(normalized, '%Y-%m-%d').date()
                except:
                    pass

            # 创建新目录条目
            execute_query(
                "INSERT INTO photo_directories (name, path, parent_id, folder_date, is_active) "
                "VALUES (%s, %s, %s, %s, 1) "
                "ON DUPLICATE KEY UPDATE name = VALUES(name), parent_id = VALUES(parent_id), "
                "folder_date = VALUES(folder_date), is_active = 1",
                (name, full_path, parent_id, folder_date),
                fetch=False
            )

        # 递归子目录
        _sync_directory_tree(dir_id if existing else execute_query(
            "SELECT id FROM photo_directories WHERE path = %s", (full_path,)
        )[0]['id'], full_path)


def _update_all_image_counts():
    """为所有 photo_directories 更新 image_count（从 DB 统计）"""
    from database import execute_query
    # 统计每个 folder_path 的非删除图片数
    rows = execute_query(
        "SELECT folder_path, COUNT(*) as cnt FROM images "
        "WHERE is_deleted = 0 AND folder_path IS NOT NULL "
        "GROUP BY folder_path"
    )
    for r in rows:
        execute_query(
            "UPDATE photo_directories SET image_count = %s WHERE path = %s",
            (r['cnt'], r['folder_path']), fetch=False
        )


def _get_photo_roots() -> List[Dict]:
    """从 DB 读取所有真实（非虚拟）的根目录"""
    from database import execute_query
    rows = execute_query(
        "SELECT id, name, path FROM photo_directories "
        "WHERE is_active = 1 AND is_virtual = 0 AND path IS NOT NULL AND path != '' "
        "AND parent_id IS NULL ORDER BY id"
    )
    return rows


def index_folder(folder_path: str) -> Dict:
    """递归扫描并索引指定文件夹的图片到数据库"""
    all_image_files = _recursive_list_images(folder_path)
    if not all_image_files:
        return {"added": 0, "skipped": 0, "total": 0}

    from collections import defaultdict
    dirs_map = defaultdict(list)
    for fp in all_image_files:
        dirs_map[os.path.dirname(fp)].append(fp)

    total_added = 0
    total_skipped = 0

    for dir_path, files in dirs_map.items():
        try:
            existing_paths = DB.images_get_existing_paths(dir_path)
        except:
            existing_paths = set()

        try:
            all_db_records = DB.images_get_all_paths(dir_path)
            for record in all_db_records:
                fp = record['file_path']
                exists = os.path.isfile(fp) if fp else False
                DB.images_mark_deleted(fp, dir_path, 0 if exists else 1)
        except Exception as e:
            print(f"Error updating is_deleted flags: {e}")

        new_files = [f for f in files if f not in existing_paths]
        to_skip = len(files) - len(new_files)

        if new_files:
            to_insert = [_get_image_info(fp, dir_path) for fp in new_files]
            params = [
                (img['file_path'], img['filename'], img['folder_date'], img['folder_path'],
                 img['file_size'], img['width'], img['height'], img['orientation'], img['perceptual_hash'])
                for img in to_insert
            ]
            try:
                DB.images_insert_many(params)
            except Exception as e:
                print(f"Error inserting images in {dir_path}: {e}")

        total_added += len(new_files)
        total_skipped += to_skip

    return {"added": total_added, "skipped": total_skipped, "total": len(all_image_files)}


def index_all_folders() -> Dict:
    """索引所有真实根目录下的所有图片（递归），并同步 DB 目录树"""
    roots = _get_photo_roots()
    total_added = 0
    total_skipped = 0

    for root in roots:
        result = scan_root_directory(root['id'], root['path'])
        total_added += result.get('added', 0)
        total_skipped += result.get('skipped', 0)

    return {"added": total_added, "skipped": total_skipped}


# ============ 内部辅助函数 ============

def _recursive_list_images(dir_path: str) -> List[str]:
    """递归列出目录下所有有效图片路径"""
    result = []
    try:
        for dirpath, dirnames, filenames in os.walk(dir_path):
            for fname in filenames:
                ext = os.path.splitext(fname)[1].lower()
                if ext not in ('.jpg', '.jpeg', '.png'):
                    continue
                fp = os.path.join(dirpath, fname)
                try:
                    if os.path.getsize(fp) < 50000:
                        continue
                except:
                    continue
                result.append(fp)
    except Exception as e:
        print(f"Error recursive listing {dir_path}: {e}")
    return result


def _get_image_info(file_path: str, folder_path: str) -> Dict:
    """获取单张图片的元信息（需要 PIL 打开）"""
    filename = os.path.basename(file_path)
    file_size = os.path.getsize(file_path)

    width, height = 0, 0
    orientation = 'landscape'
    try:
        with PILImage.open(file_path) as img:
            width, height = img.size
            orientation = 'portrait' if height > width else 'landscape' if width > height else 'square'
    except:
        pass

    folder_name = os.path.basename(folder_path)
    folder_date = None
    if '-' in folder_name:
        try:
            parts = folder_name.split('-')
            if len(parts) == 3:
                normalized = f"{int(parts[0])}-{int(parts[1]):02d}-{int(parts[2]):02d}"
                folder_date = datetime.strptime(normalized, '%Y-%m-%d').date()
        except:
            pass

    return {
        "file_path": file_path,
        "filename": filename,
        "folder_date": folder_date,
        "folder_path": folder_path,
        "file_size": file_size,
        "width": width,
        "height": height,
        "orientation": orientation,
        "perceptual_hash": None
    }


def generate_thumbnail(image_path: str, thumbnail_dir: str) -> str:
    """为图片生成缩略图，返回缩略图路径"""
    try:
        os.makedirs(thumbnail_dir, exist_ok=True)
        filename = os.path.basename(image_path)
        name, ext = os.path.splitext(filename)
        thumb_filename = f"{name}_thumb.jpg"
        thumb_path = os.path.join(thumbnail_dir, thumb_filename)
        if os.path.exists(thumb_path):
            return thumb_path
        with PILImage.open(image_path) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((400, 400), PILImage.LANCZOS)
            img.save(thumb_path, 'JPEG', quality=85, optimize=True)
        return thumb_path
    except Exception as e:
        print(f"Thumbnail error: {e}")
        return None
