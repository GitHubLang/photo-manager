"""
照片合集服务 — 基于 tags 聚类分组，先出照片后异步生成文案
"""
import json
import random
import os
from typing import List, Dict, Optional
from collections import defaultdict, Counter


from database import execute_query
from config import LOCAL_LLM_API, LOCAL_LLM_MODEL, MINIMAX_API_KEY, MINIMAX_API_URL
from core.model_router import is_local_model, get_model_name
import requests

# ============ 创意主题词库（LLM 回退用）============
CREATIVE_THEMES = [
    "街头光影", "城市律动", "暮色温柔", "晨曦微光", "静谧蓝调",
    "绿野仙踪", "暖阳午后", "暗夜星河", "秋日私语", "黑白之间",
    "冷暖人间", "极简主义", "光影交错", "烟火人间", "城市剪影",
    "水天一色", "山野闲趣", "夜色阑珊", "时光印记", "抽象几何",
    "微观世界", "金色年华", "雨后初晴", "冬日暖阳", "夏日记忆",
    "春风拂面", "巷弄深处", "窗外的世界", "倒影之美", "对称美学",
    "流动的光", "材质之美", "色彩碰撞", "留白艺术", "万物有灵",
    "人间草木", "城市记忆", "慢生活", "日常的诗", "片刻永恒",
]

PLACEHOLDER_TITLE = "⏳ 生成中..."

# ==================== 分组（快速，无LLM） ====================

def _get_export_images_with_tags() -> List[Dict]:
    """获取导出目录所有图片及其描述/标签"""
    rows = execute_query("""
        SELECT i.id, i.file_path, i.filename, i.folder_path,
               COALESCE(d.tags, '') as tags,
               COALESCE(d.description, '') as description
        FROM images i
        LEFT JOIN image_descriptions d ON i.id = d.image_id
        WHERE i.folder_path LIKE %s
        ORDER BY RAND()
    """, ("%导出%",))
    if not rows:
        rows = execute_query("""
            SELECT i.id, i.file_path, i.filename, i.folder_path,
                   COALESCE(d.tags, '') as tags,
                   COALESCE(d.description, '') as description
            FROM images i
            LEFT JOIN image_descriptions d ON i.id = d.image_id
            ORDER BY RAND()
            LIMIT 500
        """)
    return rows


def _parse_tags(tags_str: str) -> List[str]:
    if not tags_str:
        return []
    raw = [t.strip() for t in tags_str.replace("，", ",").split(",")]
    seen = set()
    result = []
    for t in raw:
        t = t.strip()
        if not t or len(t) < 1 or t in seen:
            continue
        seen.add(t)
        result.append(t)
    return result


def _group_images(images: List[Dict], target_count: int = 12) -> List[Dict]:
    """主分组逻辑：标签聚类 + 创意主题随机补充"""
    # 1. 标签倒排索引
    tag_to_ids = defaultdict(list)
    for img in images:
        tags = _parse_tags(img['tags'])
        for tag in tags:
            tag_to_ids[tag].append(img['id'])

    # 2. 有效标签（涵盖 4~15 张）
    usable = {tag: ids for tag, ids in tag_to_ids.items() if 4 <= len(ids) <= 15}

    id_to_img = {img['id']: img for img in images}
    used_ids = set()
    groups = []

    # 3. 贪心取标签组
    for tag, ids in sorted(usable.items(), key=lambda x: -len(x[1])):
        available = [iid for iid in ids if iid not in used_ids]
        if len(available) < 4:
            continue
        take = min(target_count, len(available))
        taken = available[:take]
        for tid in taken:
            used_ids.add(tid)
        groups.append({
            "theme_type": "tag",
            "theme_value": tag,
            "photos": [id_to_img[tid] for tid in taken],
        })

    # 4. 剩余图片随机分区
    remaining = [p for p in images if p['id'] not in used_ids]
    random.shuffle(remaining)
    theme_pool = list(CREATIVE_THEMES)
    random.shuffle(theme_pool)

    idx = 0
    while idx < len(remaining):
        count = min(target_count, len(remaining) - idx)
        if count < 3:
            break
        chunk = remaining[idx:idx + count]
        idx += count
        theme = theme_pool.pop(0) if theme_pool else "随拍"
        groups.append({
            "theme_type": "theme",
            "theme_value": theme,
            "photos": chunk,
        })

    random.shuffle(groups)
    return groups


# ==================== LLM 生成元数据（可并行） ====================

def _generate_meta_for_one(photos: List[Dict], theme_type: str, theme_value: str, llm_model: str = "local") -> Dict:
    """为单组合成元数据（可被并发调用）"""
    # 收集共有标签和描述
    all_tags = []
    all_descs = []
    for p in photos:
        all_tags.extend(_parse_tags(p.get('tags', '')))
        desc = p.get('description', '')
        if desc:
            all_descs.append(desc[:150])

    tag_counter = Counter(all_tags)
    common_tags = [t for t, _ in tag_counter.most_common(10)]

    # 高权重标签（出现最多的）
    top_tags = tag_counter.most_common(5)
    top_tag_str = ", ".join(f"{t}({c}张)" for t, c in top_tags)

    # 拼摘要
    desc_excerpts = all_descs[:6]

    prompt = f"""你是一个摄影集内容策划专家。这是【一组照片合集】，包含 {len(photos)} 张照片。

这些照片的共有标签（括号内为出现次数）：
{top_tag_str}

各照片描述摘要（供参考画面风格）：
{chr(10).join(f"- {d}" for d in desc_excerpts)}

⚠️ 这是【一组照片的合集】，不是单张照片！
请根据这些照片的【共同视觉特征、整体氛围、给人带来的情绪感受】来创作。

要求：
1. 标题：15字以内，有画面感、有情绪，不要只写"风景"、"蓝色"等单一标签词
2. 文案：60字以内，描述这组照片【整体给人什么感觉、什么情绪价值】，不要只说某张照片的内容
3. tags：5个话题标签，空格分隔，以#开头

返回JSON（只返回JSON，不要多余文字）：
{{{{
    "title": "合集标题",
    "description": "整体文案",
    "tags": "#标签1 #标签2 #标签3 #标签4 #标签5"
}}}}"""

    # 尝试 LLM
    try:
        messages = [{"role": "user", "content": prompt}]
        if is_local_model(llm_model):
            api_url = f"{LOCAL_LLM_API}/v1/chat/completions"
            model_name = get_model_name(llm_model)
            payload = {
                "model": model_name, "messages": messages,
                "max_tokens": 1024, "temperature": 0.9,
            }
            headers = {}
        else:
            api_url = MINIMAX_API_URL
            payload = {
                "model": "MiniMax-M2.7", "messages": messages,
                "max_tokens": 1024, "temperature": 0.9,
            }
            headers = {"Authorization": f"Bearer {MINIMAX_API_KEY}", "Content-Type": "application/json"}

        response = requests.post(api_url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(content[json_start:json_end])
            return {
                "title": data.get("title", "").strip(),
                "description": data.get("description", "").strip(),
                "tags": data.get("tags", "").strip(),
            }
    except Exception as e:
        print(f"[collection] LLM meta error for group: {e}")

    # 回退：用精心准备的标题库做有质感的回退
    ct = common_tags[:3]
    if not ct:
        ct = [theme_value]

    # 提取场景关键词
    desc_text = " ".join(all_descs[:6])
    scene_hints = []
    for w in ["城市", "街道", "夜景", "建筑", "自然", "风景", "人像", "旅行",
              "日常", "花卉", "天空", "光影", "夕阳", "清晨", "午后", "夜晚"]:
        if w in desc_text and w not in scene_hints:
            scene_hints.append(w)

    scene = scene_hints[0] if scene_hints else ""

    # 精选标题库，轮换使用
    FALLBACK_TITLES = [
        "片刻即永恒",
        "光与影的叙事",
        "平凡中的闪光",
        "视线所及的美好",
        "城市的另一面",
        "日子发着光",
        "把时间揉进画面里",
        "生活本该如此",
        "眼睛里看到的温柔",
        "收藏世界的一天",
        "不需要滤镜的瞬间",
        "按下快门的理由",
        "镜头里的小确幸",
        "一些关于光的记录",
        "日常的诗意",
        "风把故事吹进画面",
    ]
    if scene:
        scene_titles = [f"{scene}漫游", f"{scene}切片", f"{scene}独白", f"{scene}印象", f"流动的{scene}"]
        fallback_title = scene_titles[hash(str(photos[0]['id'])) % len(scene_titles)]
    else:
        fallback_title = FALLBACK_TITLES[hash(str(photos[0]['id'])) % len(FALLBACK_TITLES)]

    fallback_desc = "在寻常的角落里，发现生活的质感。每一帧都是对日常的重新审视 📷"

    return {
        "title": fallback_title,
        "description": fallback_desc,
        "tags": " ".join(f"#{t}" for t in ct[:5]) if ct else f"#{theme_value} #摄影 #记录生活",
    }


# ==================== 对外接口 ====================

def batch_generate_collections(count: int = 20, llm_model: str = "local") -> List[Dict]:
    """
    分组后同步生成文案（确保LLM结果可靠再入库）
    """
    images = _get_export_images_with_tags()
    if not images:
        return []

    # 1. 分组
    groups = _group_images(images)[:count]
    if not groups:
        return []

    # 2. 同步生成每个合集的元数据并入库
    results = []
    for i, g in enumerate(groups):
        photos = g["photos"]
        meta = _generate_meta_for_one(photos, g["theme_type"], g["theme_value"], llm_model)

        cover_path = photos[0]["file_path"]
        photo_paths = [p["file_path"] for p in photos]
        photo_ids = [p["id"] for p in photos]

        sql = """
            INSERT INTO photo_collections 
                (title, description, tags, theme_type, theme_value,
                 photo_paths, photo_ids, cover_path, llm_model)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        cid = execute_query(sql, (
            meta["title"], meta["description"], meta["tags"],
            g["theme_type"], g["theme_value"],
            json.dumps(photo_paths), json.dumps(photo_ids),
            cover_path, llm_model,
        ), fetch=False)

        print(f"[collection] #{cid}: {meta['title']}")
        results.append({
            "id": cid,
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
            "theme_type": g["theme_type"],
            "theme_value": g["theme_value"],
            "photo_paths": photo_paths,
            "photo_ids": photo_ids,
            "cover_path": cover_path,
            "photo_count": len(photos),
            "is_favorite": False,
        })

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
        collections.append(_row_to_dict(row))

    return {"collections": collections, "total": total, "page": page, "page_size": page_size}


def get_collection_detail(collection_id: int) -> Optional[Dict]:
    rows = execute_query("SELECT * FROM photo_collections WHERE id = %s", (collection_id,))
    if not rows:
        return None
    return _row_to_dict(rows[0])


def _row_to_dict(row) -> Dict:
    paths = row["photo_paths"]
    ids = row["photo_ids"]
    photo_paths = json.loads(paths) if isinstance(paths, str) else paths
    photo_ids = json.loads(ids) if isinstance(ids, str) else ids
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "tags": row["tags"],
        "theme_type": row["theme_type"],
        "theme_value": row["theme_value"],
        "photo_paths": photo_paths,
        "photo_ids": photo_ids,
        "cover_path": row["cover_path"],
        "photo_count": len(photo_paths),
        "is_favorite": bool(row["is_favorite"]),
        "created_at": str(row["created_at"]) if row["created_at"] else None,
    }


def toggle_favorite(collection_id: int) -> Dict:
    rows = execute_query("SELECT is_favorite FROM photo_collections WHERE id = %s", (collection_id,))
    if not rows:
        return {"success": False, "error": "合集不存在"}
    new_val = 1 if not rows[0]["is_favorite"] else 0
    execute_query("UPDATE photo_collections SET is_favorite = %s WHERE id = %s", (new_val, collection_id), fetch=False)
    return {"success": True, "is_favorite": bool(new_val)}


def delete_collection(collection_id: int) -> Dict:
    execute_query("DELETE FROM photo_collections WHERE id = %s", (collection_id,), fetch=False)
    return {"success": True}


def clear_all_collections() -> Dict:
    execute_query("DELETE FROM photo_collections", fetch=False)
    return {"success": True, "message": "已清空所有合集"}
