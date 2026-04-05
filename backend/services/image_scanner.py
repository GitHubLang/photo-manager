"""
图片扫描服务 - 使用 os 而非 pathlib 避免 Windows Unicode 编码问题
"""
import os
from datetime import datetime
from typing import List, Dict
from PIL import Image as PILImage, ImageOps
import imagehash

# 缩略图存储目录
THUMBNAIL_ROOT = r"D:\MySoftware\photo-manager\thumbnails"
THUMBNAIL_SIZE = (400, 400)  # 最大尺寸

from config import PHOTO_ROOT, IMAGE_EXTENSIONS
from database import execute_query, execute_many


def scan_folders() -> List[Dict]:
    """扫描图片根目录，返回目录树结构"""
    root_path = PHOTO_ROOT
    
    result = []
    
    try:
        items = os.listdir(root_path)
    except Exception as e:
        print(f"Error listing directory: {e}")
        return result
    
    # 按名称排序（按日期，新的在前）
    items = sorted(items, reverse=True)
    
    for folder_name in items:
        folder_full_path = os.path.join(root_path, folder_name)
        if os.path.isdir(folder_full_path):
            # 快速统计图片数量（不读取文件大小）
            image_count = 0
            try:
                for fname in os.listdir(folder_full_path):
                    ext = os.path.splitext(fname)[1].lower()
                    if ext in ('.jpg', '.jpeg', '.png'):
                        image_count += 1
            except:
                pass
            
            # 解析日期
            folder_date = None
            if '-' in folder_name:
                try:
                    parts = folder_name.split('-')
                    if len(parts) == 3:
                        normalized = f"{int(parts[0])}-{int(parts[1]):02d}-{int(parts[2]):02d}"
                        folder_date = datetime.strptime(normalized, '%Y-%m-%d').date()
                except:
                    pass
            
            node = {
                "path": folder_full_path,
                "name": folder_name,
                "date": str(folder_date) if folder_date else None,
                "imageCount": image_count,
                "children": []
            }
            result.append(node)
    
    return result


def generate_thumbnail(image_path: str, thumbnail_dir: str) -> str:
    """为图片生成缩略图，返回缩略图路径"""
    try:
        # 创建缩略图目录
        os.makedirs(thumbnail_dir, exist_ok=True)
        
        # 生成缩略图文件名
        filename = os.path.basename(image_path)
        name, ext = os.path.splitext(filename)
        thumb_filename = f"{name}_thumb.jpg"
        thumb_path = os.path.join(thumbnail_dir, thumb_filename)
        
        # 如果缩略图已存在，直接返回
        if os.path.exists(thumb_path):
            return thumb_path
        
        # 生成缩略图
        with PILImage.open(image_path) as img:
            img = ImageOps.exif_transpose(img)  # 修正方向
            img.thumbnail(THUMBNAIL_SIZE, PILImage.LANCZOS)
            img.save(thumb_path, 'JPEG', quality=85, optimize=True)
        
        return thumb_path
    except Exception as e:
        print(f"Thumbnail error: {e}")
        return None


def scan_folder_images(folder_path: str) -> List[Dict]:
    """扫描指定文件夹，返回所有图片信息"""
    images = []
    
    try:
        filenames = os.listdir(folder_path)
    except Exception as e:
        print(f"Error scanning folder {folder_path}: {e}")
        return images
    
    for filename in filenames:
        file_path = os.path.join(folder_path, filename)
        
        if not os.path.isfile(file_path):
            continue
        
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png'):
            continue
        
        file_size = 0
        try:
            file_size = os.path.getsize(file_path)
        except:
            pass
        
        if file_size < 50000:
            continue
        
        # 获取图片尺寸
        width, height = 0, 0
        orientation = 'landscape'
        try:
            with PILImage.open(file_path) as img:
                width, height = img.size
                orientation = 'portrait' if height > width else 'landscape' if width > height else 'square'
        except:
            pass
        
        # 感知哈希计算较慢，跳过（后续单独运行去重任务）
        phash = None
        
        # 解析文件夹日期
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
        
        images.append({
            "file_path": file_path,
            "filename": filename,
            "folder_date": folder_date,
            "folder_path": folder_path,
            "file_size": file_size,
            "width": width,
            "height": height,
            "orientation": orientation,
            "perceptual_hash": phash
        })
    
    return sorted(images, key=lambda x: x['filename'])


def index_folder(folder_path: str) -> Dict:
    """扫描并索引指定文件夹的图片到数据库"""
    images = scan_folder_images(folder_path)
    
    if not images:
        return {"added": 0, "skipped": 0, "total": 0}
    
    # 检查已存在的图片
    try:
        existing = execute_query(
            "SELECT file_path FROM images WHERE folder_path = %s",
            (folder_path,)
        )
        existing_paths = {row['file_path'] for row in existing}
    except:
        existing_paths = set()
    
    # 插入新图片
    to_insert = [img for img in images if img['file_path'] not in existing_paths]
    to_skip = len(images) - len(to_insert)
    
    if to_insert:
        insert_sql = """
            INSERT INTO images (file_path, filename, folder_date, folder_path, 
                              file_size, width, height, orientation, perceptual_hash)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = [
            (img['file_path'], img['filename'], img['folder_date'], img['folder_path'],
             img['file_size'], img['width'], img['height'], img['orientation'], img['perceptual_hash'])
            for img in to_insert
        ]
        try:
            execute_many(insert_sql, params)
        except Exception as e:
            print(f"Error inserting images: {e}")
    
    return {
        "added": len(to_insert),
        "skipped": to_skip,
        "total": len(images)
    }


def index_all_folders() -> Dict:
    """索引所有文件夹"""
    folders = scan_folders()
    total_added = 0
    total_skipped = 0
    
    for folder in folders:
        result = index_folder(folder['path'])
        total_added += result['added']
        total_skipped += result['skipped']
    
    return {"added": total_added, "skipped": total_skipped}
