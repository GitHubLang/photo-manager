# 摄影素材管理系统

一个用于摄影师管理大量照片的 Web 应用，支持 AI 评分、主题分析和画面描述生成。

## 功能特性

- 📁 **目录管理**：浏览 E:\图像 下的 141 个文件夹
- 🔍 **图片搜索**：按文件名、描述、标签搜索
- ⭐ **AI 评分**：6维度专业评分（冲击力、构图、清晰度、曝光、色彩、独特性）
- 📝 **画面描述**：AI 自动生成画面描述和标签
- 🏷️ **主题分析**：每日照片主题智能归纳
- 📊 **批量处理**：支持多图批量评分

## 技术栈

### 后端
- FastAPI (Python)
- MySQL 数据库
- PIL 图片处理
- 本地 LLM / MiniMax Vision API

### 前端
- React + Vite
- Ant Design
- 图片懒加载 + 缩略图缓存

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd photo-manager
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env 填入真实配置
```

`.env` 配置项：

| 变量 | 说明 | 示例 |
|------|------|------|
| `DB_HOST` | MySQL 地址 | `192.168.1.100` |
| `DB_PORT` | MySQL 端口 | `3306` |
| `DB_USER` | 数据库用户 | `root` |
| `DB_PASSWORD` | 数据库密码 | `your_password` |
| `DB_NAME` | 数据库名 | `photo_manager_db` |
| `LOCAL_LLM_API` | 本地 LLM 地址 | `http://192.168.1.50:1234` |
| `LOCAL_LLM_MODEL` | 本地模型名 | `qwen2.5-9b` |
| `MINIMAX_API_KEY` | MiniMax API Key | `sk-xxx` |
| `PHOTO_ROOT` | 图片根目录 | `E:\图像` |

### 3. 安装依赖

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd ../frontend
npm install
```

### 4. 启动服务

```bash
# 后端 (端口 8000)
cd backend
python main.py

# 前端 (端口 5173)
cd frontend
npm run dev
```

或使用项目根目录的脚本：
- `start.bat` - 启动
- `stop.bat` - 停止
- `restart.bat` - 重启

## 数据库初始化

首次运行需要创建数据库：

```sql
CREATE DATABASE photo_manager_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## AI 评分说明

系统支持两种 AI 模型：

1. **本地 LLM**（推荐）：支持视觉的模型如 Qwen2-VL、LLaVA 等
2. **MiniMax Vision**：使用 `MiniMax-VL-01` 模型

评分维度：
- 冲击力 (25%)
- 构图 (25%)
- 清晰度 (20%)
- 曝光 (15%)
- 色彩 (10%)
- 独特性 (5%)

## 项目结构

```
photo-manager/
├── backend/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理
│   ├── database.py          # 数据库连接池
│   ├── routers/             # API 路由
│   │   ├── images.py        # 图片相关 API
│   │   └── daily.py         # 主题分析 API
│   ├── services/            # 业务逻辑
│   │   ├── image_scanner.py # 图片扫描
│   │   ├── llm_scorer.py    # AI 评分
│   │   └── daily_theme.py   # 主题分析
│   ├── models/              # 数据模型
│   ├── .env.example         # 环境变量模板
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # 主组件
│   │   └── App.css          # 样式
│   ├── index.html
│   └── package.json
└── README.md
```

## API 文档

启动后访问：http://localhost:8000/docs

## 截图

[待添加]

## License

MIT
