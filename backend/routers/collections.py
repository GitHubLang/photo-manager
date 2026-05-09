"""
照片合集 API 路由
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from pydantic import BaseModel

from services.collection_service import (
    create_collection,
    batch_generate_collections,
    get_collections,
    get_collection_detail,
    toggle_favorite,
    delete_collection,
)

router = APIRouter(prefix="/api", tags=["collections"])


class GenerateRequest(BaseModel):
    count: int = 20
    llm_model: str = ""


@router.post("/collections/generate")
def api_generate_collections(req: GenerateRequest):
    """生成一批照片合集"""
    model = req.llm_model or "local"
    collections = batch_generate_collections(count=req.count, llm_model=model)
    return {"success": True, "collections": collections, "count": len(collections)}


@router.get("/collections")
def api_get_collections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    favorite_only: bool = Query(False),
):
    """获取合集列表"""
    return get_collections(page=page, page_size=page_size, favorite_only=favorite_only)


@router.get("/collections/{collection_id}")
def api_get_collection(collection_id: int):
    """获取单个合集详情"""
    detail = get_collection_detail(collection_id)
    if not detail:
        raise HTTPException(status_code=404, detail="合集不存在")
    return detail


@router.post("/collections/{collection_id}/favorite")
def api_toggle_favorite(collection_id: int):
    """切换收藏状态"""
    return toggle_favorite(collection_id)


@router.delete("/collections/{collection_id}")
def api_delete_collection(collection_id: int):
    """删除合集"""
    return delete_collection(collection_id)
