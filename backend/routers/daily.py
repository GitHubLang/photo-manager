"""
每日主题和文案生成 API
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import date

from database import execute_query
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


@router.get("/daily-theme/{date_str}")
async def get_daily_theme(date_str: str):
    """获取某日的主题总结"""
    theme = execute_query(
        "SELECT * FROM daily_themes WHERE date = %s",
        (date_str,)
    )
    if theme:
        return theme[0]
    return None


@router.post("/daily-theme/{date_str}/generate")
async def create_daily_theme(date_str: str):
    """生成某日的主题总结"""
    result = generate_daily_theme(date_str)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "生成失败"))
    return result


@router.get("/recommend-set/{date_str}")
async def get_recommend_set(
    date_str: str,
    set_type: str = Query("xiaohongshu", enum=["douyin", "xiaohongshu", "weibo"])
):
    """获取推荐图片组合"""
    result = recommend_photo_set(date_str, set_type)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "推荐失败"))
    return result


@router.post("/caption/generate")
async def create_caption(req: CaptionRequest):
    """生成文案"""
    result = generate_caption(req.date, req.image_ids, req.set_type)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "生成失败"))
    return result


@router.get("/caption/history/{date_str}")
async def get_caption_history(
    date_str: str,
    set_type: Optional[str] = Query(None, enum=["douyin", "xiaohongshu", "weibo"])
):
    """获取历史生成的文案"""
    if set_type:
        sql = "SELECT * FROM photo_sets WHERE date = %s AND set_type = %s ORDER BY created_at DESC"
        results = execute_query(sql, (date_str, set_type))
    else:
        sql = "SELECT * FROM photo_sets WHERE date = %s ORDER BY created_at DESC"
        results = execute_query(sql, (date_str,))
    return results


@router.post("/daily-report/{date_str}")
async def create_daily_report(date_str: str):
    """一键生成当日完整报告（主题+推荐+文案）"""
    # 1. 生成主题
    theme_result = generate_daily_theme(date_str)
    if not theme_result.get("success"):
        return {"success": False, "error": "主题生成失败", "details": theme_result}
    
    # 2. 推荐图片组
    xiaohongshu_set = recommend_photo_set(date_str, "xiaohongshu")
    douyin_set = recommend_photo_set(date_str, "douyin")
    
    # 3. 生成文案
    douyin_caption = None
    xiaohongshu_caption = None
    
    if xiaohongshu_set.get("success") and xiaohongshu_set.get("selected_images"):
        image_ids = [img['id'] for img in xiaohongshu_set["selected_images"]]
        xiaohongshu_caption = generate_caption(date_str, image_ids, "xiaohongshu")
    
    if douyin_set.get("success") and douyin_set.get("selected_images"):
        image_ids = [img['id'] for img in douyin_set["selected_images"]]
        douyin_caption = generate_caption(date_str, image_ids, "douyin")
    
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
