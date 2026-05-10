"""
LLM 评分和描述服务 - 支持本地模型和 MiniMax (Async)
"""
import asyncio
import base64
import io
import json
import httpx
from PIL import Image as PILImage, ImageOps
from typing import Dict, Optional
from config import LOCAL_LLM_API, MINIMAX_API_KEY, MINIMAX_API_URL, MINIMAX_MODEL, MINIMAX_VISION_API_URL, MINIMAX_VISION_MODEL
from db import DB
from core.model_router import is_local_model, get_model_name

SCORING_PROMPT = """你是一位专业摄影比赛评委。请根据专业摄影比赛标准对这张照片进行评分。

对每个维度，请提供：分数(0-100)、详细分析、具体改进建议。

评分维度：

1. **冲击力** [权重: 25%] - 这张照片引起的情感反应和视觉冲击力。它是否吸引注意力？是否有引人入胜的故事或情感？

2. **构图** [权重: 25%] - 视觉元素的排列如何？考虑三分法、黄金分割、平衡感、引导线、框架等。主体是否放置得当？

3. **清晰度** [权重: 20%] - 图像是否清晰锐利？主体是否对焦准确？是否有运动模糊或失焦区域？

4. **曝光** [权重: 15%] - 曝光是否正确？高光是否过曝？阴影是否欠曝？明暗区域是否有良好的细节？

5. **色彩** [权重: 10%] - 色彩是否自然悦目？白平衡是否正确？饱和度是否恰当（不过于暗淡或过于饱和）？

6. **独特性** [权重: 5%] - 这张照片有多原创和独特？是否有独特的视角或创意手法？

请按以下精确JSON格式返回分析结果（只返回JSON，不要其他内容）：
{
  "impact": {"score": 0-100, "analysis": "冲击力的详细分析", "suggestion": "具体改进建议"},
  "composition": {"score": 0-100, "analysis": "构图的详细分析", "suggestion": "具体改进建议"},
  "sharpness": {"score": 0-100, "analysis": "清晰度的详细分析", "suggestion": "具体改进建议"},
  "exposure": {"score": 0-100, "analysis": "曝光的详细分析", "suggestion": "具体改进建议"},
  "color": {"score": 0-100, "analysis": "色彩的详细分析", "suggestion": "具体改进建议"},
  "uniqueness": {"score": 0-100, "analysis": "独特性的详细分析", "suggestion": "具体改进建议"},
  "total": "加权平均总分",
  "overall_comment": "1-2句总体评价"
}

请开始评分："""

DESCRIPTION_PROMPT = """你是一位专业的摄影分析师。请详细描述这张照片的内容，并提取关键标签。

请按以下精确JSON格式返回（只返回JSON，不要其他内容）：
{
  "description": "2-3句详细的中文描述，包括照片内容、氛围和显著特征",
  "tags": "用逗号分隔的中文关键词，包括：主体类型、场景、情绪、颜色、风格等（例如：风景, 山林, 薄雾, 治愈, 冷色调, 安静）"
}

请开始描述："""


def encode_image_for_llm(image_path: str, max_size: int = 2048) -> str:
    """将图片编码为 base64，保持正确方向"""
    img = PILImage.open(image_path)
    img = ImageOps.exif_transpose(img)
    
    if max(img.size) > max_size:
        img.thumbnail((max_size, max_size), PILImage.LANCZOS)
    
    if img.mode != 'RGB':
        img = img.convert('RGB')
    
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=95, optimize=True)
    return base64.b64encode(buf.getvalue()).decode('utf-8')


def parse_llm_response(content: str) -> Optional[Dict]:
    """从 LLM 响应中解析 JSON"""
    try:
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            return json.loads(content[json_start:json_end])
    except:
        pass
    return None


async def call_llm_vision(image_path: str, prompt: str, model: str = "minimax") -> Optional[str]:
    """调用支持 Vision 的 LLM (Async)"""
    image_b64 = encode_image_for_llm(image_path)

    if is_local_model(model):
        api_url = f"{LOCAL_LLM_API}/v1/chat/completions"
        model_name = get_model_name(model)
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                    {"type": "text", "text": prompt}
                ]
            }
        ]
        payload = {
            "model": model_name,
            "messages": messages,
            "max_tokens": 4096,
            "temperature": 0.1,
        }
        headers = {}
    else:
        # 使用 MiniMax Vision API
        api_url = MINIMAX_VISION_API_URL
        payload = {
            "prompt": prompt,
            "image_url": f"data:image/jpeg;base64,{image_b64}"
        }
        headers = {
            "Authorization": f"Bearer {MINIMAX_API_KEY}",
            "Content-Type": "application/json"
        }
    
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(api_url, json=payload, headers=headers)
            print(f"LLM Vision API response status: {response.status_code}")
            response.raise_for_status()
            result = response.json()
            print(f"LLM Vision API response: {result}")
        
        if is_local_model(model):
            return result["choices"][0]["message"]["content"]
        else:
            return result.get("content", "")
    except Exception as e:
        print(f"LLM call error: {e}")
        import traceback
        traceback.print_exc()
        return None


async def score_image_with_vision(image_path: str, model: str = "minimax") -> Optional[Dict]:
    """使用 Vision LLM 评分 (Async)"""
    content = await call_llm_vision(image_path, SCORING_PROMPT, model)
    if content:
        return parse_llm_response(content)
    return None


async def describe_image_with_vision(image_path: str, model: str = "minimax") -> Optional[str]:
    """使用 Vision LLM 生成描述 (Async)"""
    content = await call_llm_vision(image_path, DESCRIPTION_PROMPT, model)
    return content  # 返回原始字符串，由调用方解析 JSON


def save_score_to_db(image_id: int, scores_data: Dict, model: str):
    """保存评分到数据库"""
    import json
    
    scores = scores_data
    print(f"[DEBUG] save_score_to_db called with image_id={image_id}, model={model}")
    
    # 处理 total 可能是 "87.5/100" 格式
    total_raw = scores.get("total", 0)
    if isinstance(total_raw, str) and "/" in total_raw:
        total_raw = total_raw.split("/")[0]
    try:
        total = float(total_raw)
    except (ValueError, TypeError):
        total = 0
    
    def get_score(dimension):
        d = scores.get(dimension, {})
        if not isinstance(d, dict):
            return 0
        score = d.get("score", 0)
        if isinstance(score, str) and "/" in score:
            score = score.split("/")[0]
        try:
            return float(score)
        except (ValueError, TypeError):
            return 0
    
    def get_analysis(dimension):
        d = scores.get(dimension, {})
        return d.get("analysis", "") if isinstance(d, dict) else ""
    
    def get_suggestion(dimension):
        d = scores.get(dimension, {})
        return d.get("suggestion", "") if isinstance(d, dict) else ""
    
    DB.score_save(
        image_id, total,
        get_score("impact"), get_analysis("impact"), get_suggestion("impact"),
        get_score("composition"), get_analysis("composition"), get_suggestion("composition"),
        get_score("sharpness"), get_analysis("sharpness"), get_suggestion("sharpness"),
        get_score("exposure"), get_analysis("exposure"), get_suggestion("exposure"),
        get_score("color"), get_analysis("color"), get_suggestion("color"),
        get_score("uniqueness"), get_analysis("uniqueness"), get_suggestion("uniqueness"),
        json.dumps(scores_data, ensure_ascii=False),
        model
    )


def save_description_to_db(image_id: int, description: str, tags: str, model: str):
    """保存描述到数据库"""
    print(f"[DEBUG] save_description_to_db called with image_id={image_id}")
    DB.description_save(image_id, description, tags, model)


async def score_and_describe_image_async(image_id: int, image_path: str, model: str = "local") -> Dict:
    """对图片进行评分和描述 (Async)"""
    result = {"image_id": image_id, "scored": False, "described": False}
    
    # 尝试评分
    score_result = await score_image_with_vision(image_path, model)
    if score_result:
        await asyncio.to_thread(save_score_to_db, image_id, score_result, model)
        result["scored"] = True
        result["scores"] = score_result
        result["score_model"] = model
    
    # 尝试描述
    desc_content = await describe_image_with_vision(image_path, model)
    if desc_content:
        desc_result = parse_llm_response(desc_content)
        if desc_result:
            await asyncio.to_thread(save_description_to_db,
                image_id,
                desc_result.get("description", desc_content),
                desc_result.get("tags", ""),
                model
            )
            result["described"] = True
            result["description"] = desc_result.get("description", desc_content)
            result["tags"] = desc_result.get("tags", "")
        else:
            await asyncio.to_thread(save_description_to_db,
                image_id, desc_content, "", model
            )
            result["described"] = True
            result["description"] = desc_content
            result["tags"] = ""
    
    return result


def score_and_describe_image(image_id: int, image_path: str, model: str = "local") -> Dict:
    """对图片进行评分和描述 (Sync wrapper)"""
    return asyncio.run(score_and_describe_image_async(image_id, image_path, model))
