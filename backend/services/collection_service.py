"""
照片合集服务 — 基于数据库已有 image_descriptions 的 tags 聚类分组，
然后利用 LLM 生成合集标题/文案/tags。
"""
import json
import random
import os
from typing import List, Dict, Optional
from collections import defaultdict

from database import execute_query
from config import LOCAL_LLM_API, LOCAL_LLM_MODEL, MINIMAX_API_KEY, MINIMAX_API_URL
from core.model_router import is_local_model, get_model_name
import requests

# ============ 创意主题词库（LLM 不可用时回退）============
CREATIVE_THEMES = [
    "街头光影", "城市律动", "暮色温柔", "晨曦微光", "静谧蓝调",
    "绿野仙踪", "暖阳午后", "暗夜星河", "秋日私语", "黑白之间",
    "冷暖人间", "极简主义", "光影交错", "烟火人间", "城市剪影",
    "水天一色", "山野闲趣", "夜色阑珊", "时光印记", "抽象几何",
    "微观世界", "金色年华", "雨后初晴", "冬日暖阳", "夏日记忆",
    "春风拂面", "海岛风情", "城市天际", "巷弄深处", "窗外的世界",
    "倒影之美", "对称美学", "流动的光", "材质之美", "色彩碰撞",
    "留白艺术", "浓墨重彩", "清新淡雅", "万物有灵", "人间草木",
]


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
    """将标签字符串解析成标签列表，去重"""
    if not tags_str:
        return []
    # 兼容英文逗号和中文逗号，去掉首尾空格
    raw = [t.strip() for t in tags_str.replace("，", ",").split(",")]
    # 去重、去空、清理特殊字符
    seen = set()
    result = []
    for t in raw:
        t = t.strip().strip("，, ")
        if not t or len(t) < 1 or t in seen:
            continue
        seen.add(t)
        result.append(t)
    return result


def _group_by_tags(images: List[Dict], target_per_collection: int = 12) -> List[Dict]:
    """基于已有 tags 聚类：共享高频标签的照片聚为一组"""
    # 1. 构建 tag → [image ids] 倒排索引
    tag_to_ids = defaultdict(list)
    for img in images:
        tags = _parse_tags(img['tags'])
        for tag in tags:
            tag_to_ids[tag].append(img['id'])

    # 2. 只保留涵盖 4~20 张的标签（不会太大也不会太小）
    usable_tags = {tag: ids for tag, ids in tag_to_ids.items() if 4 <= len(ids) <= 20}

    # 3. 建立 id → 图片 map
    id_to_img = {img['id']: img for img in images}

    # 4. 贪心分配：标记已用图片
    used_ids = set()
    groups = []  # [(theme_name, [photos])]

    # 按覆盖图片数降序排列，优先用覆盖面大的标签
    sorted_tags = sorted(usable_tags.items(), key=lambda x: -len(x[1]))
    for tag, ids in sorted_tags:
        available = [iid for iid in ids if iid not in used_ids]
        if len(available) < 4:
            continue
        # 最多取 target_per_collection 张
        take = min(target_per_collection, len(available))
        taken = available[:take]
        for tid in taken:
            used_ids.add(tid)
        groups.append((tag, [id_to_img[tid] for tid in taken]))

    return groups


def _randomly_partition_remaining(remaining: List[Dict], target_per_collection: int = 12) -> List[Dict]:
    """将未被聚类的剩余图片随机分区，赋予创意主题"""
    if not remaining:
        return []
    random.shuffle(remaining)
    groups = []
    theme_cycle = list(CREATIVE_THEMES)
    random.shuffle(theme_cycle)

    idx = 0
    while idx < len(remaining):
        count = min(target_per_collection, len(remaining) - idx)
        if count < 3:
            break
        chunk = remaining[idx:idx + count]
        idx += count
        theme = theme_cycle.pop(0) if theme_cycle else "随拍合集"
        groups.append((theme, chunk))

    return groups


def _select_photos_for_collections(total_collections: int, target_per_collection: int = 12) -> List[Dict]:
    """主入口：先用 tags 聚类，再用创意主题随机补充"""
    images = _get_export_images_with_tags()
    if not images:
        return []

    # 第一步：标签聚类
    tag_groups = _group_by_tags(images, target_per_collection)
    used_ids = set()
    for _, photos in tag_groups:
        for p in photos:
            used_ids.add(p['id'])

    print(f"[collection] tag groups: {len(tag_groups)} groups, {len(used_ids)} photos used")

    # 第二步：剩余图片随机分区
    remaining = [p for p in images if p['id'] not in used_ids]
    random_groups = _randomly_partition_remaining(remaining, target_per_collection)
    print(f"[collection] random groups: {len(random_groups)} groups")

    # 合并，优先放 tag 组的
    all_groups = []
    for theme, photos in tag_groups:
        all_groups.append({
            "theme_type": "tag",
            "theme_value": theme,
            "photos": photos,
        })
    for theme, photos in random_groups:
        all_groups.append({
            "theme_type": "theme",
            "theme_value": theme,
            "photos": photos,
        })

    # 截取目标数量
    random.shuffle(all_groups)
    return all_groups[:total_collections]


def _generate_collection_metadata(
    photos: List[Dict],
    theme_type: str,
    theme_value: str,
    collection_index: int,
    llm_model: str = "local"
) -> Dict:
    """用 LLM 生成合集标题、文案、tags，或回退到已有标签"""
    # 收集这批照片的已有描述和标签
    existing_descs = []
    existing_tags = []
    for p in photos:
        if p.get('description'):
            existing_descs.append(p['description'][:100])
        if p.get('tags'):
            parsed = _parse_tags(p['tags'])
            existing_tags.extend(parsed)

    # 统计共同出现的标签
    from collections import Counter
    tag_counter = Counter(existing_tags)
    common_tags = [t for t, c in tag_counter.most_common(8) if c >= 1]

    # ====== LLM 生成 ======
    prompt_variants = [
        f"""角色：抖音图集内容策划。

这批照片共 {len(photos)} 张，核心主题标签是：{', '.join(common_tags[:5])}

已有描述片段（供参考风格）：
{chr(10).join([f'- {d}' for d in existing_descs[:5]])}

请生成一组抖音图集文案，返回JSON（只返回JSON）：
{{{{
    "title": "合集标题（15字以内，简洁有吸引力，贴合标签）",
    "description": "文案（80字以内，文艺/治愈/生活化风格，带适当emoji）",
    "tags": "5个话题标签，空格分隔，以#开头"
}}}}""",
        f"""照片主题：{theme_value if theme_type == 'tag' else '创意摄影'}
图片数量：{len(photos)} 张
常见标签：{', '.join(common_tags[:5])}

请创作抖音图集内容（只返回JSON，不要多余文字）：
{{{{
    "title": "标题（15字内）",
    "description": "文案（80字内，有温度）",
    "tags": "#标签1 #标签2 #标签3 #标签4 #标签5"
}}}}""",
    ]

    prompt = prompt_variants[collection_index % len(prompt_variants)]

    try:
        messages = [{"role": "user", "content": prompt}]
        if is_local_model(llm_model):
            api_url = f"{LOCAL_LLM_API}/v1/chat/completions"
            model_name = get_model_name(llm_model)
            payload = {
                "model": model_name,
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.8 + (collection_index % 3) * 0.05,
            }
            headers = {}
        else:
            api_url = MINIMAX_API_URL
            payload = {
                "model": "MiniMax-M2.7",
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.8 + (collection_index % 3) * 0.05,
            }
            headers = {
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            }

        response = requests.post(api_url, json=payload, headers=headers, timeout=120)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]

        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            data = json.loads(content[json_start:json_end])
            return {
                "title": data.get("title", f"📸 {theme_value}"),
                "description": data.get("description", ""),
                "tags": data.get("tags", f"#{' #'.join(common_tags[:5])}"),
            }
    except Exception as e:
        print(f"[collection] LLM error: {e}")

    # ====== 回退：用已有标签生成 ======
    fallback_title = common_tags[0] if common_tags else theme_value
    fallback_tags = " ".join(f"#{t}" for t in common_tags[:5]) if common_tags else f"#{theme_value} #摄影 #记录生活"
    fallback_desc = f"一组关于{fallback_title}的照片记录 📸"
    if existing_descs:
        fallback_desc = random.choice(existing_descs)[:80] + " 📸"

    return {
        "title": f"📸 {fallback_title}" if not fallback_title.startswith("📸") else fallback_title,
        "description": fallback_desc,
        "tags": fallback_tags,
    }


def batch_generate_collections(count: int = 20, llm_model: str = "local") -> List[Dict]:
    """批量生成多个不同的合集，全部入库"""
    collections_data = _select_photos_for_collections(total_collections=count, target_per_collection=12)
    if not collections_data:
        return []

    results = []
    for i, data in enumerate(collections_data):
        photos = data["photos"]
        if not photos:
            continue

        meta = _generate_collection_metadata(
            photos, data["theme_type"], data["theme_value"], i, llm_model
        )

        cover_path = photos[0]["file_path"]
        photo_paths = [p["file_path"] for p in photos]
        photo_ids = [p["id"] for p in photos]

        sql = """
            INSERT INTO photo_collections 
                (title, description, tags, theme_type, theme_value, 
                 photo_paths, photo_ids, cover_path, llm_model)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        collection_id = execute_query(sql, (
            meta["title"], meta["description"], meta["tags"],
            data["theme_type"], data["theme_value"],
            json.dumps(photo_paths), json.dumps(photo_ids),
            cover_path, llm_model,
        ), fetch=False)

        results.append({
            "id": collection_id,
            "title": meta["title"],
            "description": meta["description"],
            "tags": meta["tags"],
            "theme_type": data["theme_type"],
            "theme_value": data["theme_value"],
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

    return {"collections": collections, "total": total, "page": page, "page_size": page_size}


def get_collection_detail(collection_id: int) -> Optional[Dict]:
    """获取单个合集详情"""
    rows = execute_query(
        "SELECT * FROM photo_collections WHERE id = %s", (collection_id,)
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
    rows = execute_query("SELECT is_favorite FROM photo_collections WHERE id = %s", (collection_id,))
    if not rows:
        return {"success": False, "error": "合集不存在"}
    new_val = 1 if not rows[0]["is_favorite"] else 0
    execute_query("UPDATE photo_collections SET is_favorite = %s WHERE id = %s", (new_val, collection_id), fetch=False)
    return {"success": True, "is_favorite": bool(new_val)}


def delete_collection(collection_id: int) -> Dict:
    """删除合集"""
    execute_query("DELETE FROM photo_collections WHERE id = %s", (collection_id,), fetch=False)
    return {"success": True}


# ---------- cleanup ----------
def clear_all_collections() -> Dict:
    """清空所有合集（方便重新生成）"""
    execute_query("DELETE FROM photo_collections", fetch=False)
    return {"success": True, "message": "已清空所有合集"}
