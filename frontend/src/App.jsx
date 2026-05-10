import React from 'react';
import AppShell from './layout/AppShell';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/modals.css';

/**
 * App — 应用入口
 * 极简：只做 AppShell 渲染 + 全局 CSS 导入
 * 所有导航/状态/布局逻辑都在 AppShell 内部
 */
export default function App() {
  return <AppShell />;
}
