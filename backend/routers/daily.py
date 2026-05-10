"""
每日主题和文案生成 API
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from db import DB
from services.daily_theme import (
    generate_daily_theme,
    recommend_photo_set,
    generate_caption
)

router = APIRouter(prefix="/api", tags=["daily"])


class CaptionRequest(BaseModel):
    date: str
    image_ids: List[int]
    set_type: str = "xiaohongshu"
    user_instructions: Optional[str] = None
    llm_model: str = "local"


@router.get("/daily-theme/{date_str}")
async def get_daily_theme(date_str: str):
    """获取某日的主题总结"""
    theme = DB.daily_theme_get(date_str)
    if theme:
        return theme
    return None


@router.post("/daily-theme/{date_str}/generate")
async def create_daily_theme(date_str: str):
    """生成某日的主题总结"""
    result = await generate_daily_theme(date_str)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "生成失败"))
    return result


@router.get("/recommend-set/{date_str}")
async def get_recommend_set(
    date_str: str,
    set_type: str = Query("xiaohongshu", enum=["douyin", "xiaohongshu", "weibo"])
):
    """获取推荐图片组合"""
    result = await recommend_photo_set(date_str, set_type)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "推荐失败"))
    return result


@router.post("/caption/generate")
async def create_caption(req: CaptionRequest):
    """生成文案"""
    print(f"[DEBUG] create_caption: date={req.date}, set_type={req.set_type}, image_ids={req.image_ids}, user_instructions={req.user_instructions}")
    result = await generate_caption(req.date, req.image_ids, req.set_type, user_instructions=req.user_instructions, llm_model=req.llm_model)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "生成失败"))
    return result


@router.get("/caption/history")
async def get_caption_history_all(
    keyword: Optional[str] = Query(None, description="按图片ID或文案内容搜索"),
    set_type: Optional[str] = Query(None, enum=["douyin", "xiaohongshu", "weibo"]),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """获取文案历史（不按日期分组）"""
    where_clauses = []
    params = []

    if set_type:
        where_clauses.append("set_type = %s")
        params.append(set_type)

    if keyword:
        where_clauses.append(
            "(caption_body LIKE %s OR caption_title LIKE %s OR image_ids LIKE %s)"
        )
        pattern = f"%{keyword}%"
        params.extend([pattern, pattern, pattern])

    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    total = DB.photo_sets_count(where_sql, params)

    offset = (page - 1) * page_size
    results = DB.photo_sets_search(where_sql, params, page_size, offset)

    return {
        "captions": results,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/caption/history/{date_str}")
async def get_caption_history_by_date(
    date_str: str,
    set_type: Optional[str] = Query(None, enum=["douyin", "xiaohongshu", "weibo"])
):
    """按日期获取文案"""
    return DB.photo_sets_get_by_date(date_str, set_type)


@router.post("/daily-report/{date_str}")
async def create_daily_report(date_str: str):
    """一键生成当日完整报告（主题+推荐+文案）"""
    theme_result = await generate_daily_theme(date_str)
    if not theme_result.get("success"):
        return {"success": False, "error": "主题生成失败", "details": theme_result}

    xiaohongshu_set = await recommend_photo_set(date_str, "xiaohongshu")
    douyin_set = await recommend_photo_set(date_str, "douyin")

    douyin_caption = None
    xiaohongshu_caption = None

    if xiaohongshu_set.get("success") and xiaohongshu_set.get("selected_images"):
        image_ids = [img['id'] for img in xiaohongshu_set["selected_images"]]
        xiaohongshu_caption = await generate_caption(date_str, image_ids, "xiaohongshu")

    if douyin_set.get("success") and douyin_set.get("selected_images"):
        image_ids = [img['id'] for img in douyin_set["selected_images"]]
        douyin_caption = await generate_caption(date_str, image_ids, "douyin")

    return {
        "success": True,
        "theme": theme_result.get("theme"),
        "xiaohongshu": {
            "images": xiaohongshu_set.get("selected_images", []),
            "caption": xiaohongshu_caption.get("caption") if xiaohongshu_caption else None
        },
        "douyin": {
            "images": douyin_set.get("selected_images", []),
            "caption": douyin_caption.get("caption") if douyin_caption else None
        }
    }


@router.get("/instruction-history")
async def get_instruction_history(set_type: Optional[str] = Query(None, enum=["douyin", "xiaohongshu"])):
    """获取文案指令历史"""
    return {"history": DB.instruction_history_get_all(set_type)}


class InstructionHistoryRequest(BaseModel):
    instruction: str
    set_type: str


@router.post("/instruction-history")
async def save_instruction_history(req: InstructionHistoryRequest):
    """保存文案指令到历史"""
    instruction = req.instruction.strip()
    if not instruction:
        return {"success": False, "error": "指令不能为空"}
    # trim 后避免重复
    if not DB.instruction_history_check_duplicate(instruction, req.set_type):
        DB.instruction_history_save(instruction, req.set_type)
    return {"success": True}
