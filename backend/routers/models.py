"""模型管理 API"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal
from database import execute_query

router = APIRouter(prefix="/api/models", tags=["models"])

# ============== Schema ==============

class ModelItem(BaseModel):
    id: Optional[int] = None
    name: str                        # 显示名称，如 "Qwen3.5-9B"
    api_endpoint: str                # API 地址
    api_key: Optional[str] = ""      # API Key（可选）
    model_name: str                  # 实际模型名，如 "qwen2.5-9b"
    model_type: Literal["chat", "vision"] = "chat"  # chat 或 vision
    is_default: bool = False         # 是否默认

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

# ============== CRUD ==============

@router.get("/")
async def list_models():
    """列出所有已配置的模型"""
    rows = execute_query("SELECT id, name, api_endpoint, api_key, model_name, model_type, is_default FROM models ORDER BY id", fetch=True)
    return {
        "models": [
            {
                "id": r[0],
                "name": r[1],
                "api_endpoint": r[2],
                "api_key": r[3] or "",
                "model_name": r[4],
                "model_type": r[5],
                "is_default": bool(r[6])
            } for r in rows
        ]
    }

@router.post("/")
async def create_model(model: ModelCreate):
    """添加新模型"""
    if model.is_default:
        execute_query("UPDATE models SET is_default=0", fetch=False)
    execute_query(
        "INSERT INTO models (name, api_endpoint, api_key, model_name, model_type, is_default) VALUES (%s, %s, %s, %s, %s, %s)",
        (model.name, model.api_endpoint, model.api_key or "", model.model_name, model.model_type, 1 if model.is_default else 0),
        fetch=False
    )
    row = execute_query("SELECT LAST_INSERT_ID()", fetch=True)[0]
    return {"id": row[0], "message": "Model created"}

@router.put("/{model_id}")
async def update_model(model_id: int, model: ModelUpdate):
    """更新模型"""
    current = execute_query("SELECT is_default FROM models WHERE id=%s", (model_id,), fetch=True)
    if not current:
        return {"error": "Model not found"}, 404

    updates = []
    values = []
    for field, val in [("name", model.name), ("api_endpoint", model.api_endpoint), ("api_key", model.api_key), ("model_name", model.model_name), ("model_type", model.model_type)]:
        if val is not None:
            updates.append(f"{field}=%s")
            values.append(val)
    
    if model.is_default is not None:
        if model.is_default:
            execute_query("UPDATE models SET is_default=0", fetch=False)
        updates.append("is_default=%s")
        values.append(1 if model.is_default else 0)

    if updates:
        values.append(model_id)
        execute_query(f"UPDATE models SET {', '.join(updates)} WHERE id=%s", tuple(values), fetch=False)
    return {"message": "Model updated"}

@router.delete("/{model_id}")
async def delete_model(model_id: int):
    """删除模型"""
    execute_query("DELETE FROM models WHERE id=%s", (model_id,), fetch=False)
    return {"message": "Model deleted"}

@router.get("/chat")
async def list_chat_models():
    """列出所有 chat 模型（用于文案/评分下拉）"""
    rows = execute_query("SELECT id, name, api_endpoint, api_key, model_name FROM models WHERE model_type='chat' ORDER BY is_default DESC, id", fetch=True)
    return {
        "models": [
            {"id": r[0], "name": r[1], "api_endpoint": r[2], "api_key": r[3] or "", "model_name": r[4]}
            for r in rows
        ]
    }

@router.get("/default")
async def get_default_model():
    """获取默认 chat 模型"""
    row = execute_query("SELECT id, name, api_endpoint, api_key, model_name FROM models WHERE is_default=1 AND model_type='chat' LIMIT 1", fetch=True)
    if not row:
        return {"error": "No default model"}, 404
    r = row[0]
    return {"id": r[0], "name": r[1], "api_endpoint": r[2], "api_key": r[3] or "", "model_name": r[4]}
