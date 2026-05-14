"""
图片扫描服务 - 支持多根目录 + 递归扫描
"""
import os
from datetime import datetime
from typing import List, Dict
from PIL import Image as PILImage, ImageOps
import imagehash

from config import IMAGE_EXTENSIONS
from db import DB


def _get_photo_roots() -> List[str]:
    """从数据库读取所有启用的照片根目录"""
    from database import execute_query
    rows = execute_query("SELECT path FROM photo_directories WHERE is_active = 1 ORDER BY id")
    return [row['path'] for row in rows]


def _walk_folder_tree(root_path: str) -> tuple:
    """递归遍历目录树，构建层级结构。
    返回 (nodes_list, total_image_count)。
    文件系统只负责目录结构，图片数量从 DB 批量查询（速度快得多）。
    """
    result = []
    total_count = 0
    try:
        # 只列目录，不读文件（不计文件数，从 DB 获取）
        entries = sorted(os.scandir(root_path), key=lambda e: e.name)
    except Exception as e:
        print(f"Error scanning directory {root_path}: {e}")
        return result, 0

    dir_paths = []  # 收集所有子目录路径，批量查 DB
    dir_entries = []

    for entry in entries:
        if entry.is_dir(follow_symlinks=False):
            dir_paths.append(entry.path)
            dir_entries.append(entry)

    # 批量从 DB 获取这些目录下的图片数量
    db_counts = {}
    if dir_paths:
        try:
            from database import execute_query
            placeholders = ','.join(['%s'] * len(dir_paths))
            rows = execute_query(
                f"SELECT folder_path, COUNT(*) as cnt FROM images WHERE is_deleted = 0 "
                f"AND folder_path IN ({placeholders}) GROUP BY folder_path",
                dir_paths
            )
            for r in rows:
                db_counts[r['folder_path']] = r['cnt']
        except Exception as e:
            print(f"Error querying DB counts: {e}")

    for entry in dir_entries:
        full_path = entry.path
        name = entry.name

        # 递归子目录
        children, child_recursive_count = _walk_folder_tree(full_path)

        # 本级图片数从 DB 取（没有则 0）
        direct_count = db_counts.get(full_path, 0)
        recursive_count = direct_count + child_recursive_count
        total_count += recursive_count

        # 解析日期（从文件夹名提取）
        folder_date = None
        if '-' in name:
            try:
                parts = name.split('-')
                if len(parts) == 3:
                    normalized = f"{int(parts[0])}-{int(parts[1]):02d}-{int(parts[2]):02d}"
                    folder_date = datetime.strptime(normalized, '%Y-%m-%d').date()
            except:
                pass

        node = {
            "path": full_path,
            "name": name,
            "date": str(folder_date) if folder_date else None,
            "imageCount": recursive_count,
            "children": children
        }
        result.append(node)

    # 按 name 倒序（日期新的在前）
    result.sort(key=lambda x: x['name'], reverse=True)
    return result, total_count


def scan_folders() -> List[Dict]:
    """扫描所有照片根目录，返回层级目录树
    性能优化：自底向上计数，每个目录只扫一次本级文件
    """
    roots = _get_photo_roots()
    result = []

    for root_path in roots:
        root_name = os.path.basename(root_path) or root_path
        children, root_recursive_count = _walk_folder_tree(root_path)

        result.append({
            "path": root_path,
            "name": root_name,
            "date": None,
            "imageCount": root_recursive_count,
            "children": children,
            "is_root": True  # 标记为根目录
        })

    return result


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


def _list_image_files(folder_path: str) -> List[str]:
    """列出指定文件夹中所有有效图片路径（仅一层）"""
    result = []
    try:
        for fname in os.listdir(folder_path):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in ('.jpg', '.jpeg', '.png'):
                continue
            fp = os.path.join(folder_path, fname)
            if not os.path.isfile(fp):
                continue
            try:
                if os.path.getsize(fp) < 50000:
                    continue
            except:
                continue
            result.append(fp)
    except Exception as e:
        print(f"Error listing folder {folder_path}: {e}")
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


def index_folder(folder_path: str) -> Dict:
    """
    递归扫描并索引指定文件夹的图片到数据库
    包含该文件夹及其所有子目录
    """
    # 1. 获取该目录下所有图片文件的目录集合
    all_image_files = _recursive_list_images(folder_path)
    if not all_image_files:
        return {"added": 0, "skipped": 0, "total": 0}

    # 2. 按文件夹分组，逐个子目录处理
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

        # 标记已删除的文件
        try:
            all_db_records = DB.images_get_all_paths(dir_path)
            for record in all_db_records:
                fp = record['file_path']
                exists = os.path.isfile(fp) if fp else False
                DB.images_mark_deleted(fp, dir_path, 0 if exists else 1)
        except Exception as e:
            print(f"Error updating is_deleted flags: {e}")

        # 找出新文件
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


def scan_folder_images(folder_path: str) -> List[Dict]:
    """扫描指定文件夹中所有图片（包含嵌套子目录）"""
    images = []
    all_files = _recursive_list_images(folder_path)

    for file_path in all_files:
        if not os.path.isfile(file_path):
            continue
        img_info = _get_image_info(file_path, os.path.dirname(file_path))
        images.append(img_info)

    return sorted(images, key=lambda x: x['filename'])


def index_all_folders() -> Dict:
    """索引所有根目录下的所有图片（递归）"""
    roots = _get_photo_roots()
    total_added = 0
    total_skipped = 0

    for root_path in roots:
        result = index_folder(root_path)
        total_added += result['added']
        total_skipped += result['skipped']

    return {"added": total_added, "skipped": total_skipped}


# ============ 以下为旧版单层函数，保留兼容 ============

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
