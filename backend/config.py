"""
配置管理
请复制 .env.example 为 .env 并填入真实值
"""
import os
from dotenv import load_dotenv

# 加载 .env 文件，使用 UTF-8 编码
load_dotenv(encoding='utf-8')

# MySQL 配置
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "YOUR_DB_HOST"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", "YOUR_DB_PASSWORD"),
    "database": os.getenv("DB_NAME", "photo_manager_db"),
    "charset": "utf8mb4"
}

DATABASE_NAME = os.getenv("DB_NAME", "photo_manager_db")

# 本地 LLM 配置
# 可用模型: qwen2.5-9b (文本), lmstudio-community/gemma-4-26b-a4b (视觉), lmstudio-community/gemma-4-e4b-it (视觉)
LOCAL_LLM_API = os.getenv("LOCAL_LLM_API", "http://YOUR_LOCAL_LLM_URL")

# 本地模型映射: 前端显示名 -> LM Studio实际模型名
# 在 .env 中配置 LOCAL_MODELS，多个模型用逗号分隔
# 格式: 显示名1=模型名1,显示名2=模型名2
LOCAL_MODELS_CONFIG = os.getenv("LOCAL_MODELS", "本地 Qwen2.5-9B=qwen2.5-9b,本地 Gemma-4-E4B-IT=lmstudio-community/gemma-4-26b-a4b")

# 解析模型映射
LOCAL_MODELS = {}
for item in LOCAL_MODELS_CONFIG.split(","):
    if "=" in item:
        display_name, model_name = item.split("=", 1)
        LOCAL_MODELS[display_name.strip()] = model_name.strip()

# 默认使用的本地模型
LOCAL_LLM_MODEL = os.getenv("LOCAL_LLM_MODEL", "qwen2.5-9b")

# MiniMax API
MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "YOUR_MINIMAX_API_KEY")
MINIMAX_API_URL = "https://api.minimaxi.com/v1/chat/completions"
MINIMAX_MODEL = "MiniMax-M2.7"

# MiniMax Vision API
MINIMAX_VISION_API_URL = "https://api.minimaxi.com/v1/coding_plan/vlm"
MINIMAX_VISION_MODEL = "MiniMax-VL-01"

# 图片根目录
PHOTO_ROOT = os.getenv("PHOTO_ROOT", "/path/to/your/photos")

# 支持的图片格式
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'}
