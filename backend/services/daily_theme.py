"""
每日主题总结和文案生成服务 (Async)
"""
import asyncio
import json
import httpx
from datetime import date
from typing import List, Dict, Optional
from config import LOCAL_LLM_API, LOCAL_LLM_MODEL, MINIMAX_API_KEY, MINIMAX_API_URL
from db import DB
from core.model_router import is_local_model, get_model_name


async def generate_daily_theme(date_str: str, llm_model: str = "local") -> Dict:
    """生成某日的主题总结 (Async)"""
    # 获取该日所有图片（含评分和描述）
    images = await asyncio.to_thread(DB.daily_images_get, date_str)
    
    if not images:
        return {"success": False, "error": "没有已评分的图片"}
    
    # 构建图片信息摘要
    photo_summaries = []
    for img in images[:10]:  # 取评分最高的10张
        summary = f"- {img['filename']}: 评分{img['total_score']:.1f}"
        if img.get('description'):
            summary += f", 描述: {img['description']}"
        if img.get('tags'):
            summary += f", 标签: {img['tags']}"
        photo_summaries.append(summary)
    
    prompt = f"""你是摄影主题分析专家。请分析以下照片，总结出这一天的摄影主题。

照片列表：
{chr(10).join(photo_summaries)}

请分析并返回以下JSON格式（只返回JSON，不要其他内容）：
{{
    "theme_title": "主题标题（15字以内，简洁有吸引力）",
    "theme_description": "2-3句话的主题描述，概括这一天摄影的整体风格、氛围和内容",
    "keywords": "5-8个关键词，用逗号分隔，包括：拍摄场景、天气、情绪、风格等",
    "mood": "整体情绪基调（如：安静、活力、浪漫、治愈等）",
    "color_tone": "整体色调倾向（如：暖色调、冷色调、高级灰等）"
}}

分析："""
    
    try:
        messages = [{"role": "user", "content": prompt}]
        if is_local_model(llm_model):
            api_url = f"{LOCAL_LLM_API}/v1/chat/completions"
            model_name = get_model_name(llm_model)
            payload = {"model": model_name, "messages": messages, "max_tokens": 1024, "temperature": 0.3}
            headers = {}
        else:
            api_url = MINIMAX_API_URL
            payload = {"model": "MiniMax-M2.7", "messages": messages, "max_tokens": 1024, "temperature": 0.3}
            headers = {"Authorization": f"Bearer {MINIMAX_API_KEY}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
        
        # 解析 JSON
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            theme_data = json.loads(content[json_start:json_end])
            
            # 保存到数据库（wrap DB calls）
            photo_count = await asyncio.to_thread(DB.daily_images_count, date_str)
            avg_score = await asyncio.to_thread(DB.daily_avg_score, date_str)
            
            await asyncio.to_thread(
                DB.daily_theme_save,
                date_str,
                theme_data.get("theme_title", ""),
                theme_data.get("theme_description", ""),
                photo_count,
                round(float(avg_score), 2),
                theme_data.get("keywords", "")
            )
            
            return {
                "success": True,
                "theme": theme_data,
                "photo_count": photo_count,
                "avg_score": round(float(avg_score), 2)
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    return {"success": False, "error": "未知错误"}


async def recommend_photo_set(date_str: str, set_type: str = "xiaohongshu") -> Dict:
    """推荐一组适合发布的图片 (Async)"""
    images = await asyncio.to_thread(DB.daily_top_images, date_str)
    
    if not images:
        return {"success": False, "error": "没有已评分的图片"}
    
    # 构建图片信息摘要（传给LLM筛选）
    photo_summaries = []
    for i, img in enumerate(images):
        summary = f"[{i+1}] {img['filename']}: 评分{img['total_score']:.1f}, 方向:{img['orientation']}"
        if img.get('description'):
            summary += f", 描述: {img['description']}"
        photo_summaries.append(summary)
    
    if set_type == "douyin":
        system_prompt = "你是一个抖音内容策划专家。请从照片中选择9张最适合发抖音的组图，选择标准：1.评分高 2.内容多样但不重复 3.适合竖屏展示 4.能形成叙事感"
        output_format = '返回JSON格式：{selected_ids: [1,3,5,2,4,6,7,8,9], reason: "选择理由"}'
    else:
        system_prompt = "你是一个小红书内容策划专家。请从照片中选择6-9张最适合发小红书的组图，选择标准：1.评分高 2.构图多样 3.调性统一 4.适合横屏或方图展示"
        output_format = '返回JSON格式：{selected_ids: [1,3,5,2,4,6,7,8,9], reason: "选择理由"}'
    
    prompt = f"""照片列表：
{chr(10).join(photo_summaries)}

{system_prompt}。请从以上列表中选择最佳组合。

{output_format}"""
    
    try:
        messages = [
            {"role": "system", "content": "你是一个专业的图片推荐助手。"},
            {"role": "user", "content": prompt}
        ]
        payload = {
            "model": LOCAL_LLM_MODEL,
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.3,
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{LOCAL_LLM_API}/v1/chat/completions",
                json=payload,
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
        
        # 解析 JSON
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            recommend_data = json.loads(content[json_start:json_end])
            
            # 获取选中的图片
            selected_ids = recommend_data.get("selected_ids", [])
            selected_images = [images[i-1] for i in selected_ids if i <= len(images)]
            
            return {
                "success": True,
                "selected_images": selected_images,
                "reason": recommend_data.get("reason", "")
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    return {"success": False, "error": "未知错误"}


async def generate_caption(date_str: str, image_ids: List[int], set_type: str = "xiaohongshu", user_instructions: Optional[str] = None, llm_model: str = "local") -> Dict:
    """生成发布文案 (Async)"""
    # 获取选中图片的信息
    if not image_ids:
        return {"success": False, "error": "没有选择图片"}
    
    images = await asyncio.to_thread(DB.images_get_by_ids, image_ids)
    
    if not images:
        return {"success": False, "error": "没有找到对应的图片"}
    
    # 从图片的实际 folder_date 获取日期
    actual_dates = [img['folder_date'] for img in images if img.get('folder_date')]
    has_valid_date = False
    if actual_dates:
        from collections import Counter
        date_counter = Counter(actual_dates)
        effective_date = date_counter.most_common(1)[0][0]
        if hasattr(effective_date, 'strftime'):
            effective_date_str = effective_date.strftime('%Y-%m-%d')
        else:
            effective_date_str = str(effective_date)
        import re
        if re.match(r'^\d{4}-\d{2}-\d{2}$', effective_date_str):
            has_valid_date = True
            effective_date = effective_date_str
    
    if not has_valid_date:
        effective_date = '1970-01-01'  # 非日期文件夹用占位日期
    
    # 获取主题信息（仅当有有效日期时）
    theme_info = {}
    if has_valid_date:
        theme_row = await asyncio.to_thread(DB.photo_sets_get_theme, effective_date)
        theme_info = theme_row if theme_row else {}
    
    # 构建图片描述摘要
    photo_desc = "\n".join([
        f"- {img['filename']}: {img['description'] or '无描述'}"
        for img in images
    ])
    
    # 用户要求作为最高优先级，放在最前面
    user_req_block = (f"\n⚠️ 最高优先级指令（必须严格遵守）：{user_instructions}\n") if user_instructions else ""
    # 动态决定emoji描述，避免spec与用户指令冲突
    if user_instructions and ("不要emoji" in user_instructions or "不用emoji" in user_instructions):
        emoji_style = "不要emoji，保持文字风格"
    elif user_instructions and ("带emoji" in user_instructions or "要emoji" in user_instructions):
        emoji_style = "带emoji"
    else:
        emoji_style = None  # 不指定，遵循各平台默认风格

    if set_type == "douyin":
        desc_style = emoji_style if emoji_style else "带适当emoji"
        douyin_fields = f"""请生成以下JSON格式（只返回JSON）：
{{
    "title": "标题（30字以内，有吸引力）",
    "description": "文案内容（100字以内，{desc_style}）",
    "hashtags": "#话题1 #话题2 #话题3 #话题4 #话题5"
}}"""
    else:
        content_style = emoji_style if emoji_style else "带emoji"
        xhs_fields = f"""请生成以下JSON格式（只返回JSON）：
{{
    "title": "标题（有吸引力，{content_style}）",
    "content": "正文内容（{content_style}，分段清晰，150字以内）",
    "hashtags": "#话题1 #话题2 #话题3 #话题4 #话题5 #话题6 #话题7 #话题8"
}}"""

    if has_valid_date:
        if set_type == "douyin":
            prompt = f"""你是抖音内容创作者。请根据以下照片和主题信息，生成抖音文案。
{user_req_block}照片描述：
{photo_desc}

主题：{theme_info.get('theme_title', '日常记录')}
关键词：{theme_info.get('keywords', '')}

{douyin_fields}"""
        else:
            prompt = f"""你是小红书内容创作者。请根据以下照片和主题信息，生成小红书文案。
{user_req_block}照片描述：
{photo_desc}

主题：{theme_info.get('theme_title', '日常记录')}
关键词：{theme_info.get('keywords', '')}

{xhs_fields}"""
    else:
        if set_type == "douyin":
            prompt = f"""你是抖音内容创作者。请根据以下照片内容，生成抖音文案。
{user_req_block}照片描述：
{photo_desc}

{douyin_fields}"""
        else:
            prompt = f"""你是小红书内容创作者。请根据以下照片内容，生成小红书文案。
{user_req_block}照片描述：
{photo_desc}

{xhs_fields}"""

    try:
        messages = [{"role": "user", "content": prompt}]
        if is_local_model(llm_model):
            api_url = f"{LOCAL_LLM_API}/v1/chat/completions"
            model_name = get_model_name(llm_model)
            payload = {"model": model_name, "messages": messages, "max_tokens": 2048, "temperature": 0.5}
            headers = {}
        else:
            api_url = MINIMAX_API_URL
            payload = {"model": "MiniMax-M2.7", "messages": messages, "max_tokens": 2048, "temperature": 0.5}
            headers = {"Authorization": f"Bearer {MINIMAX_API_KEY}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
        
        # 解析 JSON
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            caption_data = json.loads(content[json_start:json_end])
            
            # 保存到数据库（wrap DB calls）
            cover_id = image_ids[0] if image_ids else None
            await asyncio.to_thread(
                DB.photo_sets_save,
                effective_date, set_type, cover_id,
                caption_data.get("title", ""),
                caption_data.get("content") or caption_data.get("description", ""),
                caption_data.get("hashtags", ""),
                json.dumps(image_ids)
            )
            
            return {
                "success": True,
                "caption": caption_data,
                "image_ids": image_ids,
                "has_theme": has_valid_date
            }
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    return {"success": False, "error": "未知错误"}
