"""
统一模型路由 — 判断本地/云端,获取实际模型名
"""
from config import LOCAL_LLM_API, LOCAL_LLM_MODEL, LOCAL_MODELS
from database import execute_query


def is_local_model(model: str) -> bool:
    """判断模型是本地还是云端：先查 LOCAL_MODELS，再查 DB"""
    if model.startswith("local"):
        return True
    if model in LOCAL_MODELS:
        return True
    try:
        rows = execute_query(
            "SELECT api_endpoint FROM models WHERE name = %s LIMIT 1", (model,)
        )
        if rows:
            ep = rows[0].get('api_endpoint', '')
            return any(x in ep for x in ('192.168', 'localhost', '127.0.0.1'))
    except Exception:
        pass
    return False


def get_model_name(model: str) -> str:
    """获取实际 API 用的模型名"""
    if model in LOCAL_MODELS:
        return LOCAL_MODELS[model]
    if model.startswith("local"):
        return LOCAL_LLM_MODEL
    try:
        rows = execute_query(
            "SELECT model_name FROM models WHERE name = %s LIMIT 1", (model,)
        )
        if rows:
            return rows[0].get('model_name', model)
    except Exception:
        pass
    return model
