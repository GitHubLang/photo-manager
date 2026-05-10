# Photo Manager 系统设计文档

## 架构概述

```
App.jsx (入口)
└── AppShell (唯一布局壳，仅一个 isMobile 分支)
    ├── TopBar (共享顶部栏，variant='desktop'|'mobile')
    ├── [PC] Layout.Sider (260px, collapsible) + Sidebar
    ├── [移动] HamburgerDrawer + BottomTabs
    └── PageRouter (根据 activePage + subTab 渲染页面)
        ├── BrowsePage    ← 素材浏览 (文件夹+图片网格+操作)
        ├── ScoresPage    ← 评分记录
        ├── CaptionsPage  ← 文案记录
        ├── CollectionPage ← 照片合集
        ├── LutPage       ← LUT 克隆
        └── SettingsPage  ← 设置聚合 (subTab 决定子页)
```

## 设计原则

### 1. isMobile 集中化

**isMobile 判断只允许出现在 AppShell.jsx 一个文件中。** 页面组件和子组件不得使用 isMobile。

手机/PC 差异通过以下方式处理：
- **视觉差异** → CSS 媒体查询 `@media (max-width: 767px)`
- **JS 行为差异** → 仅在 AppShell 分支，或使用 `useMediaQuery` hook（尽量少用）

```jsx
// ✅ 允许：仅在 AppShell 一处分支
if (!isMobile) {
  return <Sider><Sidebar /></Sider>;
}
return <HamburgerDrawer />;

// ✅ 允许：CSS 处理视觉差异
@media (max-width: 767px) { .action-bar { display: none; } }

// ❌ 禁止：页面组件内 isMobile 判断
{isMobile ? <A /> : <B />}
```

### 2. 菜单数据驱动

`config/menu.js` 是唯一配置源。新增菜单只需加一项，PC侧边栏、移动端抽屉、底部tab 自动同步。

```js
menuItems = [
  { key: 'browse',      label: '素材',     icon, primary: true },  // primary=true → 移动端底部tab
  { key: 'scores',      label: '评分记录', icon },
  { key: 'captions',    label: '文案记录', icon },
  { key: 'collections', label: '照片合集', icon, primary: true },
  { key: 'lut',         label: 'LUT克隆',  icon, primary: true },
  { key: 'settings',    label: '设置',     icon,
    children: [
      { key: 'settings-general', label: '通用设置' },
      { key: 'settings-models',  label: '模型管理' },
      { key: 'settings-theme',   label: '主题切换' },
    ]
  },
]
```

### 3. 页面 = 菜单项

每个菜单项对应一个独立页面。评分和文案是独立页面，不再是 BrowsePage 的子面板/抽屉。

页面路由在 `pages/PageRouter.jsx` 的 `PAGES` 映射中注册。

### 4. CSS 模块化

一个页面一个 CSS 文件，全局样式按职责拆分：

```
styles/
├── tokens.css      ← CSS 变量
├── layout.css      ← AppShell/TopBar/Sidebar/BottomNav/Drawer
├── browse.css      ← 图片网格/卡片/操作栏/FAB
├── modals.css      ← 弹窗通用样式
├── scores.css      ← 评分记录页
├── captions.css    ← 文案记录页
├── settings.css    ← 设置页
├── collection.css  ← 合集页
└── lut.css         ← LUT页
```

### 5. 页面宽度规则

- **桌面端**：页面内容填充侧边栏外的全部可用宽度，不居中限制
- **移动端**：全屏宽，padding 由 CSS 控制

### 6. 移动端交互规则

- **action-bar 隐藏**：移动端 `@media (max-width: 767px) { .action-bar { display: none; } }`
- **翻页器隐藏**：`.pagination-bar` 在移动端 `display: none`
- **排序/翻页/批量操作**：全部放入右下角 FAB 浮动按钮菜单
- **FAB**：通过 CSS `display: none` / `display: flex` 控制 PC/移动显隐，不走 JS 判断
- **底部 tab**：仅 `primary: true` 的菜单项显示

## 新增菜单/页面步骤

1. `config/menu.js` 加一项（设置 `primary` 决定是否进底部tab）
2. 创建 `pages/NewPage.jsx`
3. `pages/PageRouter.jsx` 的 `PAGES` 映射加一行
4. 创建 `styles/newpage.css`（可选）

## 状态管理

AppShell 内部管理所有 hooks（useImages/useSearch/useScore/useCaption），通过 props 传递给页面组件。页面组件不需要 Provider/Context 包装。

## 文件结构

```
frontend/src/
├── App.jsx                     ← 入口（极简）
├── App.css                     ← CSS re-exports
│
├── layout/
│   ├── AppShell.jsx             ← 唯一 isMobile 分支点
│   ├── TopBar.jsx               ← variant='desktop'|'mobile'
│   ├── Sidebar.jsx              ← PC 侧边栏菜单
│   ├── BottomTabs.jsx           ← 移动底部 tab
│   └── HamburgerDrawer.jsx      ← 移动菜单抽屉
│
├── pages/
│   ├── PageRouter.jsx           ← 路由映射
│   ├── BrowsePage.jsx           ← 素材浏览
│   ├── ScoresPage.jsx           ← 评分记录
│   ├── CaptionsPage.jsx         ← 文案记录
│   ├── CollectionPage.jsx       ← 照片合集
│   ├── LutPage.jsx              ← LUT 克隆
│   └── SettingsPage.jsx         ← 设置（subTab 渲染子页）
│
├── components/
│   ├── image/     (ImageGrid, ImageCard)
│   ├── modals/    (ImagePreview, CaptionResult, Theme, Benchmark)
│   └── settings/  (GeneralSettings, ThemeSwitcher)
│
├── hooks/         (useImages, useSearch, useScore, useCaption, useMediaQuery)
├── config/menu.js
└── styles/        (CSS 模块)
```
