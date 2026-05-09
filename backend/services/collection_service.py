"""
照片合集服务 — 从导出目录按主题/色系随机分组，生成合集
"""
import json
import random
import re
from datetime import date
from typing import List, Dict, Optional
from collections import Counter

from database import execute_query
from config import LOCAL_LLM_API, LOCAL_LLM_MODEL, MINIMAX_API_KEY, MINIMAX_API_URL
from core.model_router import is_local_model, get_model_name
from PIL import Image as PILImage
import os
import io
import base64
import requests

# ============ 色系关键词库 ============
COLOR_THEMES = [
    ("蓝色系", ["蓝", "蓝色", "天空", "海洋", "湖", "水", "冰", "冷色"]),
    ("绿色系", ["绿", "绿色", "森林", "树木", "植物", "自然", "草地", "叶子"]),
    ("暖橙色系", ["橙", "橙色", "暖色", "日落", "黄昏", "夕阳", "晚霞"]),
    ("红紫色系", ["红", "红色", "紫", "紫色", "粉", "粉色", "花", "晚霞"]),
    ("金色系", ["金", "金色", "阳光", "光束", "光芒", "逆光"]),
    ("灰调系", ["灰", "灰色", "黑白", "雾", "阴天", "极简", "暗调"]),
    ("黄色系", ["黄", "黄色", "花", "油菜花", "秋", "秋天", "银杏"]),
    ("黑白系", ["黑白", "单色", "极简", "高对比", "剪影"]),
]

# 主题词库
THEME_KEYWORDS = [
    "街景", "建筑", "人像", "风景", "城市", "夜景",
    "微观", "抽象", "纪实", "旅行", "美食", "动物",
    "花卉", "风光", "人文", "长焦", "广角", "航拍",
]
THEME_KEYWORDS_EN = [
    "street", "architecture", "portrait", "landscape", "city", "night",
    "macro", "abstract", "documentary", "travel", "food", "animal",
    "flower", "scenery", "humanity", "telephoto", "wideangle", "drone",
]


def _get_all_export_images() -> List[Dict]:
    """获取导出目录所有图片"""
    rows = execute_query(
        "SELECT id, file_path, filename, folder_path FROM images WHERE folder_path LIKE %s ORDER BY RAND()",
        ("%导出%",)
    )
    if not rows:
        # 如果导出目录没找到，从全部图片随机取
        rows = execute_query(
            "SELECT id, file_path, filename, folder_path FROM images ORDER BY RAND() LIMIT 500"
        )
    return rows


def _extract_dominant_color_tag(filename: str, file_path: str) -> Optional[str]:
    """尝试从文件名/路径提取色系关键词"""
    text = f"{filename} {file_path}".lower()
    for theme_name, keywords in COLOR_THEMES:
        for kw in keywords:
            if kw in text:
                return theme_name
    return None


def _group_by_theme_from_db() -> List[Dict]:
    """按文件路径的主题关键词分组所有导出图片"""
    images = _get_all_export_images()
    # 按 folder_path 的末端关键词分组
    groups = {}
    for img in images:
        # 提取文件夹名称关键词
        folder = img['folder_path'] or ''
        filename = img['filename'] or ''
        combined = f"{folder} {filename}".lower()
        
        # 尝试匹配色系
        color_tag = _extract_dominant_color_tag(filename, folder)
        
        # 尝试匹配主题关键词
        matched_themes = []
        for kw in THEME_KEYWORDS:
            if kw in combined:
                matched_themes.append(kw)
        
        # 生成分组 key
        group_key = color_tag or (matched_themes[0] if matched_themes else "日常")
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append(img)
    
    return groups


def _select_photos_for_collection(target_count: int = 12) -> Dict:
    """从导出目录选择合适的照片组成一个合集"""
    groups = _group_by_theme_from_db()
    
    # 排除太少的分组，优先选有足够照片的分组
    valid_groups = {k: v for k, v in groups.items() if len(v) >= target_count * 0.5}
    
    if not valid_groups:
        valid_groups = groups
    
    # 随机选一个分组
    theme = random.choice(list(valid_groups.keys()))
    pool = valid_groups[theme]
    
    # 尽可能选 target_count 张，不够就全部取
    target = min(target_count, len(pool))
    target = max(target, min(3, len(pool)))  # 最少3张
    
    selected = random.sample(pool, target)
    
    return {
        "theme_type": "color" if any(theme.startswith(c[0][:2]) for c in COLOR_THEMES) else "theme",
        "theme_value": theme,
        "photos": selected,
    }


def _generate_collection_metadata(
    photos: List[Dict],
    theme_type: str,
    theme_value: str,
    llm_model: str = "local"
) -> Dict:
    """用LLM生成合集标题、文案、tags"""
    # 构建图片摘要
    photo_summaries = []
    for p in photos:
        fname = p['filename'] or ''
        fpath = p['file_path'] or ''
        photo_summaries.append(f"- {fname} ({fpath})")
    
    prompt = f"""你是抖音图集的内容策划专家。我给出一组照片，请你生成一个适合抖音图集的标题、文案和标签。

这组照片的主题/色系是：{theme_value}（类型：{theme_type}）

照片列表：
{chr(10).join(photo_summaries)}

请分析这些照片的共同特点，生成以下JSON格式（只返回JSON）：
{{
    "title": "合集标题（15字以内，有吸引力，适合抖音图集）",
    "description": "文案（80字以内，文艺或治愈风格，带适当emoji）",
    "tags": "#话题1 #话题2 #话题3 #话题4 #话题5"
}}"""

    try:
        messages = [{"role": "user", "content": prompt}]
        if is_local_model(llm_model):
            api_url = f"{LOCAL_LLM_API}/v1/chat/completions"
            model_name = get_model_name(llm_model)
            payload = {
                "model": model_name,
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.7,
            }
            headers = {}
        else:
            api_url = MINIMAX_API_URL
            payload = {
                "model": "MiniMax-M2.7",
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.7,
            }
            headers = {
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            }

        response = requests.post(api_url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]

        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(content[json_start:json_end])
            return {
                "title": data.get("title", f"{theme_value}合集"),
                "description": data.get("description", ""),
                "tags": data.get("tags", ""),
            }
    except Exception as e:
        print(f"[collection] LLM metadata generation error: {e}")

    # 回退：生成默认元数据
    return {
        "title": f"📸 {theme_value}合集",
        "description": f"一组{theme_value}风格的照片，记录生活的美好瞬间 🎨",
        "tags": f"#{theme_value} #摄影 #记录生活 #光影",
    }


def create_collection(llm_model: str = "local") -> Dict:
    """生成一个照片合集并存入数据库"""
    # 选照片
    selection = _select_photos_for_collection(target_count=12)
    photos = selection["photos"]
    
    if not photos:
        return {"success": False, "error": "没有找到合适的照片"}
    
    # 生成元数据
    meta = _generate_collection_metadata(
        photos, selection["theme_type"], selection["theme_value"], llm_model
    )
    
    # 封面图
    cover_path = photos[0]["file_path"]
    photo_paths = [p["file_path"] for p in photos]
    photo_ids = [p["id"] for p in photos]
    
    # 存入数据库
    sql = """
        INSERT INTO photo_collections 
            (title, description, tags, theme_type, theme_value, 
             photo_paths, photo_ids, cover_path, llm_model)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    collection_id = execute_query(sql, (
        meta["title"],
        meta["description"],
        meta["tags"],
        selection["theme_type"],
        selection["theme_value"],
        json.dumps(photo_paths),
        json.dumps(photo_ids),
        cover_path,
        llm_model,
    ), fetch=False)
    
    return {
        "success": True,
        "collection": {
            "id": collection_id,
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
            "theme_type": selection["theme_type"],
            "theme_value": selection["theme_value"],
            "photo_paths": photo_paths,
            "photo_ids": photo_ids,
            "cover_path": cover_path,
            "photo_count": len(photos),
            "is_favorite": False,
        }
    }


def batch_generate_collections(count: int = 20, llm_model: str = "local") -> List[Dict]:
    """批量生成多个合集"""
    results = []
    existing = set()
    
    # 避免生成重复的合集（同一个theme_value不重复生成）
    for _ in range(count * 2):  # 容错次数
        if len(results) >= count:
            break
        try:
            result = create_collection(llm_model)
            if result.get("success"):
                theme_val = result["collection"]["theme_value"]
                if theme_val in existing:
                    continue
                existing.add(theme_val)
                results.append(result["collection"])
        except Exception as e:
            print(f"[collection] batch generate error: {e}")
            continue
    
    return results


def get_collections(page: int = 1, page_size: int = 20, favorite_only: bool = False) -> Dict:
    """获取合集列表"""
    offset = (page - 1) * page_size
    where = "WHERE is_favorite = 1" if favorite_only else ""
    
    count_sql = f"SELECT COUNT(*) as total FROM photo_collections {where}"
    total = execute_query(count_sql)[0]["total"]
    
    query_sql = f"""
        SELECT * FROM photo_collections 
        {where}
        ORDER BY created_at DESC 
        LIMIT %s OFFSET %s
    """
    rows = execute_query(query_sql, (page_size, offset))
    
    collections = []
    for row in rows:
        collections.append({
            "id": row["id"],
            "title": row["title"],
            "description": row["description"],
            "tags": row["tags"],
            "theme_type": row["theme_type"],
            "theme_value": row["theme_value"],
            "photo_paths": json.loads(row["photo_paths"]) if isinstance(row["photo_paths"], str) else row["photo_paths"],
            "photo_ids": json.loads(row["photo_ids"]) if isinstance(row["photo_ids"], str) else row["photo_ids"],
            "cover_path": row["cover_path"],
            "photo_count": len(json.loads(row["photo_paths"])) if isinstance(row["photo_paths"], str) else len(row["photo_paths"]),
            "is_favorite": bool(row["is_favorite"]),
            "created_at": str(row["created_at"]) if row["created_at"] else None,
        })
    
    return {
        "collections": collections,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


def get_collection_detail(collection_id: int) -> Optional[Dict]:
    """获取单个合集详情"""
    rows = execute_query(
        "SELECT * FROM photo_collections WHERE id = %s",
        (collection_id,)
    )
    if not rows:
        return None
    row = rows[0]
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "tags": row["tags"],
        "theme_type": row["theme_type"],
        "theme_value": row["theme_value"],
        "photo_paths": json.loads(row["photo_paths"]) if isinstance(row["photo_paths"], str) else row["photo_paths"],
        "photo_ids": json.loads(row["photo_ids"]) if isinstance(row["photo_ids"], str) else row["photo_ids"],
        "cover_path": row["cover_path"],
        "photo_count": len(json.loads(row["photo_paths"])) if isinstance(row["photo_paths"], str) else len(row["photo_paths"]),
        "is_favorite": bool(row["is_favorite"]),
        "created_at": str(row["created_at"]) if row["created_at"] else None,
    }


def toggle_favorite(collection_id: int) -> Dict:
    """切换收藏状态"""
    rows = execute_query(
        "SELECT is_favorite FROM photo_collections WHERE id = %s",
        (collection_id,)
    )
    if not rows:
        return {"success": False, "error": "合集不存在"}
    
    new_val = 1 if not rows[0]["is_favorite"] else 0
    execute_query(
        "UPDATE photo_collections SET is_favorite = %s WHERE id = %s",
        (new_val, collection_id),
        fetch=False
    )
    return {
        "success": True,
        "is_favorite": bool(new_val),
    }


def delete_collection(collection_id: int) -> Dict:
    """删除合集"""
    execute_query(
        "DELETE FROM photo_collections WHERE id = %s",
        (collection_id,),
        fetch=False
    )
    return {"success": True}


# ============ 颜色分析 ============

def _get_dominant_color_tags(image_path: str) -> List[str]:
    """（简化版）提取图片主色调标签"""
    # 实际实现可以用 colorz / colorthief 库
    # 这里先用文件名和路径关键词匹配
    return []


def _estimate_image_theme(filename: str, file_path: str) -> List[str]:
    """从文件名和路径推测主题"""
    text = f"{filename} {file_path}".lower()
    themes = []
    for kw in THEME_KEYWORDS:
        if kw in text:
            themes.append(kw)
    for kw in THEME_KEYWORDS_EN:
        if kw in text:
            themes.append(kw)
    return themes


def rebuild_collections_for_theme(theme_value: str, llm_model: str = "local") -> Dict:
    """为特定主题重新生成合集"""
    images = _get_all_export_images()
    matched = []
    for img in images:
        combined = f"{img['folder_path']} {img['filename']}".lower()
        if theme_value.lower() in combined:
            matched.append(img)
    
    if not matched:
        return {"success": False, "error": f"没有找到主题为 {theme_value} 的照片"}
    
    if len(matched) > 12:
        matched = random.sample(matched, 12)
    
    meta = _generate_collection_metadata(matched, "theme", theme_value, llm_model)
    photo_paths = [p["file_path"] for p in matched]
    photo_ids = [p["id"] for p in matched]
    
    sql = """
        INSERT INTO photo_collections 
            (title, description, tags, theme_type, theme_value, 
             photo_paths, photo_ids, cover_path, llm_model)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    collection_id = execute_query(sql, (
        meta["title"], meta["description"], meta["tags"],
        "theme", theme_value,
        json.dumps(photo_paths), json.dumps(photo_ids),
        matched[0]["file_path"], llm_model,
    ), fetch=False)
    
    return {
        "success": True,
        "collection": {
            "id": collection_id,
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
            "theme_type": "theme",
            "theme_value": theme_value,
            "photo_paths": photo_paths,
            "photo_ids": photo_ids,
            "cover_path": matched[0]["file_path"],
            "photo_count": len(matched),
            "is_favorite": False,
        }
    }
