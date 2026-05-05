# Photo Manager - 架构设计规范

## 一、当前架构分析

### 1.1 现状

```
frontend/                          backend/
  App.jsx     (550行, god组件)       routers/images.py (688行, 单一文件)
  ├─ 评分状态                         ├─ 文件夹CRUD
  ├─ 文案状态                         ├─ 图片CRUD
  ├─ 模型管理                         ├─ 评分任务 + 线程
  ├─ 图片选择                         ├─ 缩略图/代理
  ├─ 预览/下载                        ├─ 扫描进度
  └─ 所有事件传递                     └─ ...
  components/
    layout/
      SideMenu.jsx (菜单硬编码)      routers/daily.py
      TopToolbar.jsx                 routers/models.py
    modals/                         services/
    image/                            image_scanner.py
    score/                            llm_scorer.py
    caption/                          daily_theme.py
  hooks/                            main.py (路由注册)
    useImages.js (300行)
    useScore.js
    useCaption.js
    useSearch.js
  api/imageApi.js (所有API集中)
```

### 1.2 添加新功能需要改的文件

| 当前需要改 | 文件 |
|-----------|------|
| 1. 菜单项 | `SideMenu.jsx` - 硬编码 Menu.Item |
| 2. 菜单状态 | `App.jsx` - `activeMenu` state |
| 3. 组件渲染 | `App.jsx` - 条件渲染 `{activeMenu==='xxx' && <XxxPanel/>}` |
| 4. 数据状态 | `App.jsx` - `useXxx()` hook |
| 5. 事件传递 | `App.jsx` - props drilling 层层传递 |
| 6. API 函数 | `imageApi.js` - 追加 export |
| 7. 后端路由 | 可能挤进 `images.py` 或新文件 |
| 8. 路由注册 | `main.py` - `app.include_router(...)` |

**结论：每加一个功能要动 8 个地方，App.jsx 最核心但耦合最重。**

### 1.3 核心问题

| 问题 | 表现 |
|------|------|
| App.jsx 是瓶颈 | 所有状态、事件、渲染集中在一个文件 |
| 菜单硬编码 | SideMenu 里写死 `<Menu.Item key="scores">` |
| Props 层层传递 | `handleScore` 从 App → ImageGrid → ImageCard |
| API 集中管理 | `imageApi.js` 包含所有接口，无模块划分 |
| 后端路由混杂 | `images.py` 688 行，文件夹+图片+评分全在一起 |
| 无统一状态管理 | useState 散落各处，跨组件共享靠 props |

---

## 二、目标架构

### 2.1 核心原则

1. **功能即模块** — 每个功能是一个独立文件夹，包含自己的路由/hook/组件
2. **菜单数据驱动** — 菜单配置是数据，加功能 = 加配置项 + 加文件夹
3. **Context 替代 Props** — 全局状态用 React Context，消除 drilling
4. **后端按职责拆分** — 每个 router 文件 ≤ 200 行
5. **添加新功能只改 2 个地方** — 菜单配置 + 新功能文件夹

### 2.2 目标目录结构

```
frontend/src/
  App.jsx                  ← 极简，只做布局 + Context Provider
  config/
    menu.js                ← 菜单配置（数据驱动）
    routes.js              ← 路由配置（可选，配合 react-router）
  context/
    AppContext.jsx          ← 全局状态 (selectedFolder, selectedImages...)
    ScoreContext.jsx        ← 评分任务状态
    CaptionContext.jsx      ← 文案状态
  pages/
    folder/                 ← 功能模块：文件夹浏览
      index.jsx             ← 页面入口
      components/
        ImageGrid.jsx
        ImageCard.jsx
        PreviewModal.jsx
      hooks/
        useFolder.js
        useImageList.js
        usePagination.js
        useSelection.js
      api.js                ← 模块专属 API
    scores/                 ← 功能模块：评分记录
      index.jsx
      components/ScoreList.jsx
      hooks/useScoreTasks.js
      api.js
    captions/               ← 功能模块：文案记录
      index.jsx
      ...
    settings/               ← 功能模块：设置
      index.jsx
      ...
    upload/                 ← 未来模块：上传评分
      index.jsx
      ...
  components/
    layout/
      AppLayout.jsx         ← 布局壳
      Sidebar.jsx           ← 从配置生成菜单
      TopBar.jsx
  shared/
    ImageThumbnail.jsx      ← 共享组件
    useApi.js               ← 共享 hook
    constants.js

backend/
  main.py                   ← 极简，只注册路由
  routers/
    folders.py              ← 文件夹 API (≤150行)
    images.py               ← 图片 CRUD + 缩略图 (≤200行)
    scoring.py              ← 评分任务 (≤200行)
    caption.py              ← 文案 + 主题 (≤200行)
    models.py               ← 模型管理 (≤100行)
    upload.py               ← 未来模块
    scan.py                 ← 扫描异步任务
  services/
    image_scanner.py        ← 扫描逻辑
    llm_service.py          ← 统一 LLM 调用 (本地/云端路由)
    score_service.py        ← 评分线程管理
  core/
    config.py               ← 配置
    database.py             ← 数据库
    models/                 ← Pydantic schemas
```

### 2.3 菜单配置（数据驱动）

```javascript
// frontend/src/config/menu.js
import { 
  FolderOutlined, StarOutlined, FileTextOutlined, 
  SettingOutlined, UploadOutlined 
} from '@ant-design/icons';

export const menuConfig = [
  {
    key: 'folder',
    icon: FolderOutlined,
    label: '文件夹',
    type: 'submenu',         // 子菜单（含文件夹树）
    badge: null,             // 可选徽标
  },
  {
    key: 'scores',
    icon: StarOutlined,
    label: '评分记录',
    type: 'page',
    badge: 'failedScores',   // 从 context 取徽标数
  },
  {
    key: 'captions',
    icon: FileTextOutlined,
    label: '文案记录',
    type: 'page',
    badge: null,
  },
  { type: 'divider' },
  {
    key: 'settings',
    icon: SettingOutlined,
    label: '设置',
    type: 'modal',           // 弹窗类型
  },
  // === 加新功能只需加一项 ===
  // {
  //   key: 'upload',
  //   icon: UploadOutlined,
  //   label: '上传评分',
  //   type: 'page',
  // },
];
```

### 2.4 添加新功能的标准步骤（目标）

```
1. 在 menu.js 加一项配置          ← 1 行
2. 在 pages/ 下创建功能文件夹      ← 标准模板
   pages/xxx/
     index.jsx        ← 页面入口
     hooks/useXxx.js  ← 数据 hook
     api.js           ← API 调用
     components/      ← 功能组件（可选）
3. 在 backend/routers/ 加路由文件（如需新 API）
4. 在 main.py 注册路由（如需）
```

**改动点：2-4 个文件 vs 现在的 8 个。**

---

## 三、重构步骤

### 第一步：后端拆分（低风险，前端无感）

```
1. routers/images.py 拆分为:
   → routers/folders.py    (文件夹接口)
   → routers/images.py     (图片接口)
   → routers/scoring.py    (评分接口)
   → routers/scan.py       (扫描接口)
   
2. llm_scorer.py 的模型路由抽象为 core/model_router.py
3. daily_theme.py → llm_service.py (Chat API 统一入口)
```

### 第二步：前端 Context 化

```
1. 创建 AppContext    — selectedFolder, selectedImages, displayImages
2. 创建 ScoreContext  — scoreTasks, failedScores, scoringIds
3. 创建 CaptionContext— captionHistory, generatedCaption
4. App.jsx 变成纯 Provider 壳
```

### 第三步：页面模块化

```
1. 每个功能变成 pages/ 下的独立模块
2. Sidebar 从 menu.js 配置生成
3. 核心渲染：{activeKey === 'folder' && <FolderPage/>}
```

### 第四步：可选优化

```
- TypeScript 迁移（渐进式）
- React Router（如果需要 URL 导航）
- 后端 Service 层抽象
- 统一错误处理
```

---

## 四、影响评估

| 方面 | 重构前 | 重构后 |
|------|--------|--------|
| 加新菜单 | 改 8 个文件 | 改 2-4 个文件 |
| App.jsx 行数 | 550+ | ~80 |
| 单文件最大行数 | 688 (后端) | ≤200 |
| 跨组件通信 | props drilling | Context |
| 后端路由 | 3 个大文件 | 6+ 小文件 |
| 菜单配置 | 硬编码 JSX | 数据驱动 |

---

## 五、是否启动？

重构分步进行，每一步独立可测。建议从**后端拆分**开始（对外无影响），然后**前端 Context 化**，最后**页面模块化**。
