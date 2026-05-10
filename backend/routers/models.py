"""模型管理 API"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal
from db import DB
from database import get_connection

router = APIRouter(prefix="/api/models", tags=["models"])

# ============== Schema ==============

class ModelCreate(BaseModel):
    name: str
    api_endpoint: str
    api_key: Optional[str] = ""
    model_name: str
    model_type: Literal["chat", "vision"] = "chat"
    is_default: bool = False

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    api_endpoint: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    model_type: Optional[Literal["chat", "vision"]] = None
    is_default: Optional[bool] = None

# ============== Helpers ==============

def _row_to_dict(r) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "api_endpoint": r["api_endpoint"],
        "api_key": r["api_key"] or "",
        "model_name": r["model_name"],
        "model_type": r["model_type"],
        "is_default": bool(r["is_default"])
    }

# ============== CRUD ==============

@router.get("/")
async def list_models():
    rows = DB.models_list()
    return {"models": [_row_to_dict(r) for r in rows]}

@router.post("/")
async def create_model(model: ModelCreate):
    row_id = DB.models_create(
        model.name, model.api_endpoint, model.api_key or "",
        model.model_name, model.model_type, model.is_default
    )
    return {"id": row_id, "message": "Model created"}

@router.put("/{model_id}")
async def update_model(model_id: int, model: ModelUpdate):
    current = DB.models_get(model_id)
    if not current:
        return {"error": "Model not found"}

    updates = {}
    for field, val in [
        ("name", model.name),
        ("api_endpoint", model.api_endpoint),
        ("api_key", model.api_key),
        ("model_name", model.model_name),
        ("model_type", model.model_type),
    ]:
        if val is not None:
            updates[field] = val

    if model.is_default is not None:
        updates["is_default"] = 1 if model.is_default else 0

    if updates:
        DB.models_update(model_id, updates)
    return {"message": "Model updated"}

@router.delete("/{model_id}")
async def delete_model(model_id: int):
    DB.models_delete(model_id)
    return {"message": "Model deleted"}

@router.get("/chat")
async def list_chat_models():
    rows = DB.models_list_chat()
    return {"models": [
        {"id": r["id"], "name": r["name"], "api_endpoint": r["api_endpoint"],
         "api_key": r["api_key"] or "", "model_name": r["model_name"]} for r in rows
    ]}

@router.get("/default")
async def get_default_model():
    result = DB.models_get_default()
    if not result:
        return {"error": "No default model"}
    return result
