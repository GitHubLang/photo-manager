import React from 'react';
import BrowsePage from './BrowsePage';
import ScoresPage from './ScoresPage';
import CaptionsPage from './CaptionsPage';
import CollectionPage from './CollectionPage';
import LutPage from './LutPage';
import SettingsPage from './SettingsPage';

/** 页面路由映射 — 新增页面在此加一行 */
const PAGES = {
  browse:      BrowsePage,
  scores:      ScoresPage,
  captions:    CaptionsPage,
  collections: CollectionPage,
  lut:         LutPage,
  settings:    SettingsPage,
};

/**
 * PageRouter — 根据 page key 渲染对应页面
 * 所有 props 透明传递，页面组件自行消费
 */
export default function PageRouter({ page, ...props }) {
  const Component = PAGES[page];
  if (!Component) return <BrowsePage {...props} />;
  return <Component {...props} />;
}
