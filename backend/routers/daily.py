"""
每日主题和文案生成 API
"""
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from typing import List, Optional

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
    user_instructions: Optional[str] = None


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
    result = generate_caption(req.date, req.image_ids, req.set_type, user_instructions=req.user_instructions)
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

    count_sql = f"SELECT COUNT(*) as total FROM photo_sets WHERE {where_sql}"
    total = execute_query(count_sql, params)[0]['total']

    offset = (page - 1) * page_size
    query_sql = f"""
        SELECT ps.*, i.file_path as cover_filename
        FROM photo_sets ps
        LEFT JOIN images i ON ps.cover_image_id = i.id
        WHERE {where_sql}
        ORDER BY ps.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([page_size, offset])
    results = execute_query(query_sql, params)

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
    if set_type:
        sql = """SELECT ps.*, i.file_path as cover_filename FROM photo_sets ps
           LEFT JOIN images i ON ps.cover_image_id = i.id
           WHERE ps.date = %s AND ps.set_type = %s ORDER BY ps.created_at DESC"""
        results = execute_query(sql, (date_str, set_type))
    else:
        sql = """SELECT ps.*, i.file_path as cover_filename FROM photo_sets ps
           LEFT JOIN images i ON ps.cover_image_id = i.id
           WHERE ps.date = %s ORDER BY ps.created_at DESC"""
        results = execute_query(sql, (date_str,))
    return results


@router.post("/daily-report/{date_str}")
async def create_daily_report(date_str: str):
    """一键生成当日完整报告（主题+推荐+文案）"""
    theme_result = generate_daily_theme(date_str)
    if not theme_result.get("success"):
        return {"success": False, "error": "主题生成失败", "details": theme_result}

    xiaohongshu_set = recommend_photo_set(date_str, "xiaohongshu")
    douyin_set = recommend_photo_set(date_str, "douyin")

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


@router.get("/instruction-history")
async def get_instruction_history(set_type: Optional[str] = Query(None, enum=["douyin", "xiaohongshu"])):
    """获取文案指令历史"""
    if set_type:
        rows = execute_query(
            "SELECT id, instruction, set_type, created_at FROM instruction_history WHERE set_type = %s ORDER BY created_at DESC LIMIT 20",
            (set_type,)
        )
    else:
        rows = execute_query(
            "SELECT id, instruction, set_type, created_at FROM instruction_history ORDER BY created_at DESC LIMIT 20"
        )
    return {"history": rows}


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
    existing = execute_query(
        "SELECT id FROM instruction_history WHERE TRIM(instruction) = %s AND set_type = %s LIMIT 1",
        (instruction, req.set_type)
    )
    if not existing:
        execute_query(
            "INSERT INTO instruction_history (instruction, set_type) VALUES (%s, %s)",
            (instruction, req.set_type),
            fetch=False
        )
    return {"success": True}
