# Photo Manager 系统设计文档

## 架构概述

```
App.jsx (设备检测 + Provider)
└── AppShell (唯一布局壳，一个 isMobile 分支)
    ├── TopBar (共享顶部栏)
    ├── [PC] Sidebar / [移动] HamburgerDrawer + BottomTabs
    └── PageRouter (根据 activePage 渲染页面)
        ├── BrowsePage    ← 素材浏览 (文件夹+图片网格+操作)
        ├── ScoresPage    ← 评分记录
        ├── CaptionsPage  ← 文案记录
        ├── CollectionPage ← 照片合集
        ├── LutPage       ← LUT 克隆
        └── SettingsPage  ← 设置聚合
```

## 设计原则

1. **页面组件无 isMobile**：所有 `isMobile` 判断集中在 AppShell，页面组件只处理业务逻辑
2. **菜单数据驱动**：`config/menu.js` 是唯一配置源，新增菜单只需加一项
3. **CSS 媒体查询处理视觉差异**：布局/间距/列数等差异走 CSS，不走 JSX 三元
4. **PC和移动端各自有独立导航组件**：Sidebar(PC) vs HamburgerDrawer+BottomTabs(移动)

## 菜单配置

```js
// config/menu.js
menuItems = [
  { key: 'browse',      label: '素材',     icon, primary: true },
  { key: 'scores',      label: '评分记录', icon },
  { key: 'captions',    label: '文案记录', icon },
  { type: 'divider' },
  { key: 'collections', label: '照片合集', icon, primary: true },
  { key: 'lut',         label: 'LUT克隆',  icon, primary: true },
  { type: 'divider' },
  { key: 'settings',    label: '设置',     icon,
    children: [
      { key: 'settings-general', label: '通用设置' },
      { key: 'settings-models',  label: '模型管理' },
      { key: 'settings-theme',   label: '主题切换' },
    ]
  },
]
```

- `primary: true` → 同时出现在移动端底部 tab
- `children` → 子菜单项，设置页用 Tabs 切换
- `type: 'divider'` → 菜单分隔线

## 导航

- **PC**：左侧常驻 Sidebar，所有菜单项垂直排列，侧边栏可折叠
- **移动端**：顶部 ☰ 打开全屏抽屉菜单 + 底部 tab 显示 primary 菜单
- 新增菜单：只改 `menu.js` 数组 + `pages` 映射对象加一行

## 页面路由

```js
const ROUTES = {
  browse:      BrowsePage,
  scores:      ScoresPage,
  captions:    CaptionsPage,
  collections: CollectionPage,
  lut:         LutPage,
  settings:    SettingsPage,
  'settings-general': SettingsPage,   // 带 subTab
  'settings-models':  SettingsPage,
  'settings-theme':   SettingsPage,
}
```

## CSS 结构

```
styles/
├── tokens.css      ← CSS 变量/设计令牌
├── layout.css      ← AppShell, TopBar, Sidebar, BottomTabs, HamburgerDrawer
├── browse.css      ← 图片网格、卡片、操作栏
├── scores.css      ← 评分记录页
├── captions.css    ← 文案记录页
├── collection.css  ← 合集页
├── lut.css         ← LUT 页
├── settings.css    ← 设置页
└── modals.css      ← 弹窗通用样式
```

## 状态管理

AppContext 提供：
- 图片浏览 (useImages)
- 搜索 (useSearch)
- 评分 (useScore)
- 文案 (useCaption)
- UI 状态 (selectedImages, previewVisible 等)

页面组件通过 `useAppContext()` 获取，不走 props drilling。

## 页面组件规范

每个页面组件：
- 通过 `useAppContext()` 获取全局状态
- 不判断 `isMobile`
- 不直接操作导航（通过 `setActivePage` 回调）
- 样式差异用 CSS 媒体查询处理
