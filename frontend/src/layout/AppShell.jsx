import React, { useState, useCallback } from 'react';
import { Layout } from 'antd';
const { Sider } = Layout;
import { useMediaQuery } from '../hooks/useMediaQuery';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import BottomTabs from './BottomTabs';
import HamburgerDrawer from './HamburgerDrawer';
import { menuItems, buildMenuMap } from '../config/menu';
import { useImages } from '../hooks/useImages';
import { useSearch } from '../hooks/useSearch';
import { useScore } from '../hooks/useScore';
import { useCaption } from '../hooks/useCaption';
import PageRouter from '../pages/PageRouter';

/**
 * AppShell — 唯一布局壳
 * PC和移动端在此分支，页面组件不知道自己在什么设备上
 * 所有 isMobile 判断集中在此文件
 */
export default function AppShell() {
  const isMobile = useMediaQuery('(max-width: 767px)');

  // 当前页面（从菜单 key 映射）
  const [activePage, setActivePage] = useState('browse');
  const [subTab, setSubTab] = useState(null);
  const [menuCollapsed, setMenuCollapsed] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

  // 全局 hooks
  const imageHook = useImages();
  const searchHook = useSearch({ onSearchStart: () => {} });
  const scoreHook = useScore();
  const captionHook = useCaption();

  // 菜单 key → 页面路由映射
  const menuMap = buildMenuMap();

  const handleMenuClick = useCallback((key) => {
    // 文件夹路径 → 加载该文件夹图片，切到素材页
    if (key.startsWith('__folder__')) {
      const folderPath = key.replace('__folder__', '');
      imageHook.loadImages(folderPath);
      setActivePage('browse');
      return;
    }

    const item = menuMap[key];
    if (!item) {
      setActivePage(key);
      return;
    }

    // 设置子项 → SettingsPage 带 subTab
    if (item.key.startsWith('settings-')) {
      setActivePage('settings');
      setSubTab(item.key);
      return;
    }

    setActivePage(item.key);
    setSubTab(null);
  }, [menuMap, imageHook]);

  const handleFolderSelect = useCallback((path) => {
    imageHook.loadImages(path);
    setActivePage('browse');
  }, [imageHook]);

  const handleSearch = useCallback((value) => {
    if (!value?.trim()) {
      searchHook.clearSearch();
      return;
    }
    setActivePage('browse');
    searchHook.handleSearch(value);
  }, [searchHook]);

  const handleScoreImageClick = useCallback((task) => {
    if (!task.file_path) return;
    const folderPath = task.file_path.substring(0, task.file_path.lastIndexOf('\\'));
    imageHook.loadImages(folderPath, 1);
    setActivePage('browse');
  }, [imageHook]);

  // PC 端布局
  if (!isMobile) {
    return (
      <div className="app-layout">
        <TopBar variant="desktop" onSearch={handleSearch} onScan={imageHook.handleScanAll} />
        <div className="app-body">
          <Sider
            width={260}
            collapsible
            collapsed={menuCollapsed}
            onCollapse={setMenuCollapsed}
            className="folder-sider"
          >
            <Sidebar
              collapsed={menuCollapsed}
              activePage={activePage}
              folders={imageHook.folders}
              selectedFolder={imageHook.selectedFolder}
              onMenuClick={handleMenuClick}
              onFolderSelect={handleFolderSelect}
            />
          </Sider>
          <PageRouter
            page={activePage}
            subTab={subTab}
            imageHook={imageHook}
            searchHook={searchHook}
            scoreHook={scoreHook}
            captionHook={captionHook}
            onScoreImageClick={handleScoreImageClick}
            onNavigate={handleMenuClick}
          />
        </div>
      </div>
    );
  }

  // 移动端布局
  return (
    <div className="app-layout">
      <TopBar
        variant="mobile"
        onSearch={handleSearch}
        onMenuClick={() => setMenuDrawerOpen(true)}
      />
      <HamburgerDrawer
        open={menuDrawerOpen}
        activePage={activePage}
        folders={imageHook.folders}
        onClose={() => setMenuDrawerOpen(false)}
        onMenuSelect={handleMenuClick}
        onFolderSelect={handleFolderSelect}
      />
      <PageRouter
        page={activePage}
        subTab={subTab}
        isMobile={true}
        imageHook={imageHook}
        searchHook={searchHook}
        scoreHook={scoreHook}
        captionHook={captionHook}
        onScoreImageClick={handleScoreImageClick}
        onNavigate={handleMenuClick}
      />
      <BottomTabs activePage={activePage} onTabChange={handleMenuClick} />
    </div>
  );
}
