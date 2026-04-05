"""
摄影素材管理系统 - FastAPI 后端
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from database import init_database
from routers import images, daily

app = FastAPI(
    title="摄影素材管理系统",
    description="用于管理摄影素材、AI评分、主题总结和文案生成",
    version="1.0.0"
)

# CORS 配置，允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(images.router)
app.include_router(daily.router)


@app.get("/")
async def root():
    return {"message": "摄影素材管理系统 API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/models")
async def get_models():
    """获取可用的评分模型列表"""
    from config import LOCAL_MODELS, MINIMAX_VISION_MODEL
    
    local_models = [
        {"id": model_id, "name": model_id, "type": "local"}
        for name, model_id in LOCAL_MODELS.items()
    ]
    
    return {
        "models": local_models + [
            {"id": "minimax", "name": "MiniMax Vision", "type": "cloud"}
        ]
    }


@app.on_event("startup")
async def startup_event():
    """启动时初始化数据库"""
    print("正在初始化数据库...")
    init_database()
    print("数据库初始化完成")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
