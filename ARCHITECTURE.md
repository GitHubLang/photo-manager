# 摄影素材管理系统 — 架构文档

> 最后更新: 2026-05-14

---

## 一、整体架构

```
┌─────────────────────────────────────────────┐
│              前端 (Vite + React)              │
│  Ant Design + 自定义 hooks + CSS Variables  │
└──────────────────┬──────────────────────────┘
                   │ HTTP (Fetch API)
                   ▼
┌─────────────────────────────────────────────┐
│         后端 (FastAPI + uvicorn)              │
│  端口: 8000  运行: Python 3.11              │
├─────────────────────────────────────────────┤
│  routers/       ← API 路由层                 │
│  services/      ← 业务逻辑层                 │
│  db.py          ← 数据访问层 (统一入口)      │
│  database.py    ← 连接池 + 表结构初始化     │
│  config.py      ← 配置 (从 .env 加载)        │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│        MySQL (MariaDB) — photo_manager_db     │
│  字符集: utf8mb4  连接池: 20                 │
└─────────────────────────────────────────────┘
```

---

## 二、核心设计理念

### DB 驱动的目录管理（2026-05-14 重构）
- **菜单从 DB 读取**，不碰文件系统（加载速度 0.02s）
- **目录 CRUD 只改库**，不影响实际磁盘目录
- **扫描时才走文件系统**——遍历目录、索引图片、更新计数
- **支持虚拟目录**——无文件系统路径，照片手动关联

---

## 三、数据库表结构

### 3.1 `images` — 图片主表

```sql
id              BIGINT PK AUTO_INCREMENT
file_path       VARCHAR(500) UNIQUE NOT NULL   -- 完整路径
filename        VARCHAR(255) NOT NULL
folder_date     DATE                            -- 从文件夹名解析的日期
folder_path     VARCHAR(500)                    -- 所属文件夹路径
file_size       BIGINT
width           INT
height          INT
orientation     ENUM('landscape','portrait','square')
perceptual_hash VARCHAR(64)                     -- 感知哈希（去重用）
theme_tags      VARCHAR(255)
thumbnail_path  VARCHAR(500)
created_at      DATETIME
indexed_at      DATETIME
is_deleted      TINYINT(1) DEFAULT 0
```

### 3.2 `image_scores` — 评分结果

```sql
id              BIGINT PK AUTO_INCREMENT
image_id        BIGINT FK → images.id (UNIQUE)
total_score     DECIMAL(5,2)
impact_score    DECIMAL(5,2) + impact_analysis + impact_suggestion
composition_*  同上（构图）
sharpness_*    同上（清晰度）
exposure_*     同上（曝光）
color_*        同上（色彩）
uniqueness_*   同上（独特性）
raw_response    JSON                           -- LLM 原始响应
llm_model       VARCHAR(100)
scored_at       DATETIME
```

每个维度 3 字段：score（分数）、analysis（分析）、suggestion（改进建议）。

### 3.3 `photo_directories` — 目录树（DB 驱动核心表）

```sql
id              INT PK AUTO_INCREMENT
name            VARCHAR(200) NOT NULL DEFAULT ''  -- 显示名称
path            VARCHAR(500)                      -- 文件系统路径（虚拟目录为 NULL）
is_virtual      TINYINT(1) DEFAULT 0              -- 1=虚拟目录
parent_id       INT DEFAULT NULL                  -- 父目录 ID（支持嵌套树）
is_active       TINYINT(1) DEFAULT 1
image_count     INT DEFAULT 0                     -- 缓存计数，仅扫描时更新
folder_date     DATE DEFAULT NULL                 -- 从路径提取的日期
sort_order      INT DEFAULT 0
created_at      DATETIME
updated_at      DATETIME ON UPDATE CURRENT_TIMESTAMP

UNIQUE KEY uk_path (path)
INDEX idx_parent (parent_id)
INDEX idx_active (is_active)
```

**设计要点**：
- `path` 可为 NULL：虚拟目录没有文件系统对应
- `parent_id` 实现嵌套树，根目录的 parent_id = NULL
- `image_count` 仅由扫描更新，不实时统计

### 3.4 `directory_images` — 目录-图片关联（虚拟目录用）

```sql
id              BIGINT PK AUTO_INCREMENT
directory_id    INT FK → photo_directories.id
image_id        BIGINT FK → images.id
sort_order      INT DEFAULT 0
added_at        DATETIME

UNIQUE KEY uk_dir_image (directory_id, image_id)
```

### 3.5 `score_tasks` — 评分任务队列

```sql
id              BIGINT PK AUTO_INCREMENT
image_id        BIGINT FK → images.id
status          ENUM('pending','processing','completed','failed')
model           VARCHAR(50)
error_message   TEXT
created_at      DATETIME
completed_at    DATETIME
```

### 3.6 `user_settings` — 用户设置

```sql
key             VARCHAR(100) PK
value           TEXT
```

### 3.7 其他辅助表

| 表名 | 用途 |
|------|------|
| `image_descriptions` | 图片描述 + 标签 |
| `daily_themes` | 每日主题总结 |
| `photo_sets` | 推荐组合（抖音/小红书/微博） |
| `photo_collections` | 照片合集（支持 BGM + 收藏） |
| `models` | AI 模型配置（API 端点 + 密钥） |
| `app_state` | 应用状态（浏览位置恢复） |
| `instruction_history` | 文案指令历史 |

---

## 四、API 设计

### 4.1 文件夹/目录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/folders` | 获取目录树（从 DB 读，0.02s） |
| GET | `/api/folders/{path}/images` | 获取指定文件夹图片列表（分页） |
| POST | `/api/folders/scan` | 扫描指定文件夹 |
| POST | `/api/folders/scan-all` | 后台扫描所有根目录（返回 task_id） |
| GET | `/api/folders/scan-all/progress` | 查询扫描进度 |

### 4.2 目录管理（CRUD）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/photo-directories` | 列出所有目录 |
| POST | `/api/photo-directories` | 创建目录（真实/虚拟） |
| PUT | `/api/photo-directories/{id}` | 更新目录信息 |
| DELETE | `/api/photo-directories/{id}` | 删除目录（仅 DB） |
| POST | `/api/photo-directories/{id}/toggle` | 启用/禁用 |
| POST | `/api/photo-directories/{id}/scan` | 扫描该目录（同步 + 索引 + 计数） |

### 4.3 目录图片关联（虚拟目录）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/photo-directories/{id}/images` | 获取目录下图片列表 |
| POST | `/api/photo-directories/{id}/images` | 为目录关联图片 |
| DELETE | `/api/photo-directories/{id}/images` | 移除图片关联 |

### 4.4 图片

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/images/batch?ids=` | 批量获取图片信息 |
| GET | `/api/images/{id}` | 单张图片详情 |
| GET | `/api/image/thumbnail/{path}` | 缩略图（缓存） |
| GET | `/api/image/proxy/{path}` | 图片代理访问 |
| GET | `/api/search?keyword=` | 全局搜索 |

### 4.5 评分

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/score` | 创建评分任务（异步） |
| GET | `/api/images/score/status/{id}` | 查询评分状态 |
| GET | `/api/images/score/results/{id}` | 获取评分结果 |
| GET | `/api/score-tasks` | 评分任务列表 |
| POST | `/api/score-tasks/retry` | 重新评分 |

### 4.6 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取设置 |
| POST | `/api/settings` | 保存设置 |

---

## 五、扫描流程

```
用户点击「扫描」
       │
       ▼
  scan_root_directory(id, path)
       │
       ├── 1. index_folder(path)
       │       递归 os.walk 扫描所有图片
       │       对比 DB existing_paths → 新增/跳过/标记删除
       │
       ├── 2. _sync_directory_tree(id, path)
       │       递归 os.scandir
       │       对比 DB photo_directories
       │       → 新目录 INSERT，已有目录 UPDATE name
       │
       └── 3. _update_all_image_counts()
               统计每个 folder_path 的非删除图片数
               UPDATE photo_directories.image_count
```

### 性能优化
- **计数不入文件系统**：`get_directory_tree()` 从 DB 读取，0.02s
- **扫描只计一次**：`_sync_directory_tree` 每个目录只 `os.scandir` 一次
- **30s 缓存已移除**：因为 DB 读取已经 0.02s，无需缓存

---

## 六、评分流程

```
用户点击评分（图片或批量）
       │
       ▼
  POST /api/images/score
       │
       ├── 检查已有 pending/processing 任务（防重复）
       ├── INSERT score_tasks (status=pending)
       └── 启动后台线程
              │
              ├── UPDATE status=processing
              ├── score_and_describe_image()
              │    ├── MiniMax API 或 本地 LLM
              │    ├── 返回 6 维度评分 + 分析 + 建议
              │    └── DB.score_save() INSERT/UPDATE
              │
              └── UPDATE status=completed/failed
```

### 常用模型
- **MiniMax-M2.7** (云端，`api.minimax.chat/v1`)
- **Qwen3.5-9B** (本地，`192.168.71.55:1234`)
- 可通过设置切换默认评分模型

---

## 七、前端架构

### 页面路由 (PageRouter)
| 路由 key | 组件 | 说明 |
|----------|------|------|
| `browse` | BrowsePage | 素材浏览（文件夹+图片网格） |
| `scores` | ScoresPage | 评分记录列表 |
| `captions` | CaptionsPage | 文案记录 |
| `collections` | CollectionPage | 照片合集 |
| `lut` | LutPage | LUT 克隆 |
| `settings` | SettingsPage | 设置（含子页面） |

### 设置子页面
| subTab | 组件 | 说明 |
|--------|------|------|
| `settings-general` | GeneralSettings | 默认模型、BGM 目录 |
| `settings-photo-dirs` | PhotoDirectoriesSettings | 目录管理（CRUD + 虚拟目录） |
| `settings-models` | ModelManagement | AI 模型 API 配置 |
| `settings-theme` | ThemeSwitcher | 界面主题 |

### 关键 Hooks
- `useImages()` — 文件夹/图片加载、排序、扫描、浏览位置恢复
- `useSearch()` — 全局搜索
- `useScore()` — 评分状态管理
- `useCaption()` — 文案生成历史

### 布局自适应
- PC: Sidebar (300px) + Content
- Mobile: BottomTabs + HamburgerDrawer

---

## 八、关键历史修复记录

| 日期 | 问题 | 修复 |
|------|------|------|
| 2026-05-14 | `score_save` SQL 22列但 21 个 `%s` 占位符 | 加了一个 `%s` |
| 2026-05-14 | 目录树 O(n²) 递归计数，加载 3s+ | 改为 DB 读取，0.02s |
| 2026-05-14 | 单根目录硬编码 | 改为 DB 存储 + CRUD 管理 |
| 2026-05-14 | 仅扫描一层目录 | 改为递归 os.walk 扫描 |

---

## 九、开发约定

### 代码修改必 commit
每次修改代码后必须 `git add -A && git commit -m "..." && git push`

### 服务重启规则
- **必须询问用户**后才能执行 restart/stop/start
- 包括：Gateway、photo-manager 后端/前端 等所有服务

### 后端
- 使用 `UTF8JSONResponse` 确保 JSON 编码正确
- 数据库连接走 `database.get_connection()`（连接池）
- 数据访问统一走 `DB` 类（`db.py`）

### 前端
- `API_BASE` 硬编码 `http://localhost:8000/api`
- 设置同时存 localStorage（快速读）和 DB（持久化）
- 状态恢复：localStorage → fetchAppState()

---

## 十、快速启动

```bash
# 后端
cd D:\MySoftware\photo-manager\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# 前端（开发模式）
cd D:\MySoftware\photo-manager\frontend
npm run dev

# 前端（生产构建）
cd D:\MySoftware\photo-manager\frontend
npm run build
```

### .env 配置示例
```env
DB_HOST=192.168.x.x
DB_PORT=3306
DB_USER=root
DB_PASSWORD=xxx
DB_NAME=photo_manager_db

LOCAL_LLM_API=http://192.168.x.x:1234
LOCAL_LLM_MODEL=qwen/qwen3.5-9b
LOCAL_MODELS=Qwen3.5-9B=qwen/qwen3.5-9b,...
```
