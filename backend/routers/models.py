"""模型管理 API"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal
from database import get_connection, execute_query

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
    rows = execute_query(
        "SELECT id, name, api_endpoint, api_key, model_name, model_type, is_default FROM models ORDER BY id",
        fetch=True
    )
    return {"models": [_row_to_dict(r) for r in rows]}

@router.post("/")
async def create_model(model: ModelCreate):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        if model.is_default:
            cursor.execute("UPDATE models SET is_default=0")
        cursor.execute(
            "INSERT INTO models (name, api_endpoint, api_key, model_name, model_type, is_default) VALUES (%s, %s, %s, %s, %s, %s)",
            (model.name, model.api_endpoint, model.api_key or "", model.model_name, model.model_type, 1 if model.is_default else 0)
        )
        conn.commit()
        row_id = cursor.lastrowid
    finally:
        cursor.close()
        conn.close()
    return {"id": row_id, "message": "Model created"}

@router.put("/{model_id}")
async def update_model(model_id: int, model: ModelUpdate):
    current = execute_query("SELECT is_default FROM models WHERE id=%s", (model_id,), fetch=True)
    if not current:
        return {"error": "Model not found"}

    updates = []
    values = []
    for field, val in [
        ("name", model.name),
        ("api_endpoint", model.api_endpoint),
        ("api_key", model.api_key),
        ("model_name", model.model_name),
        ("model_type", model.model_type)
    ]:
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
    execute_query("DELETE FROM models WHERE id=%s", (model_id,), fetch=False)
    return {"message": "Model deleted"}

@router.get("/chat")
async def list_chat_models():
    rows = execute_query(
        "SELECT id, name, api_endpoint, api_key, model_name FROM models WHERE model_type='chat' ORDER BY is_default DESC, id",
        fetch=True
    )
    return {"models": [
        {"id": r["id"], "name": r["name"], "api_endpoint": r["api_endpoint"],
         "api_key": r["api_key"] or "", "model_name": r["model_name"]} for r in rows
    ]}

@router.get("/default")
async def get_default_model():
    row = execute_query(
        "SELECT id, name, api_endpoint, api_key, model_name FROM models WHERE is_default=1 AND model_type='chat' LIMIT 1",
        fetch=True
    )
    if not row:
        return {"error": "No default model"}
    r = row[0]
    return {
        "id": r["id"], "name": r["name"], "api_endpoint": r["api_endpoint"],
        "api_key": r["api_key"] or "", "model_name": r["model_name"]
    }
