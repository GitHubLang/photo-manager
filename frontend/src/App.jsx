import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from 'antd';
import './App.css';

import { useImages } from './hooks/useImages';
import { useSearch } from './hooks/useSearch';
import { useScore } from './hooks/useScore';
import { useCaption } from './hooks/useCaption';

import TopToolbar from './components/layout/TopToolbar';
import BottomTabs from './components/layout/BottomTabs';
import { MenuDrawer } from './components/layout/MobileDrawers';
import { ScoreDrawer } from './components/score/ScorePanel';
import { CaptionDrawer } from './components/caption/CaptionPanel';

import FolderPage from './pages/FolderPage';
import ModelPage from './pages/ModelPage';
import GeneralPage from './pages/GeneralPage';
import LutPage from './pages/LutPage';
import CollectionPage from './pages/CollectionPage';
import { fetchBatchImages } from './api/imageApi';

function App() {
  // ============ 设备 & UI状态 ============
  const [isMobile, setIsMobile] = useState(false);
  const [activeMenu, setActiveMenu] = useState('folder');
  const [menuCollapsed, setMenuCollapsed] = useState(false);

  // 移动端抽屉
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [captionDrawerOpen, setCaptionDrawerOpen] = useState(false);

  // ============ 核心状态 (from hooks) ============
  const imageHook = useImages();
  const searchHook = useSearch({
    onSearchStart: () => {}
  });
  const scoreHook = useScore();
  const captionHook = useCaption();

  // 移动端检测
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // activeMenu 同步
  useEffect(() => {
    if (activeMenu !== 'folder') {
      if (activeMenu === 'scores') scoreHook.loadScoreTasks(scoreHook.scoreTaskFilter === 'all' ? null : scoreHook.scoreTaskFilter);
      if (activeMenu === 'captions') captionHook.loadCaptionHistory(captionHook.captionKeyword, captionHook.captionTypeFilter);
    }
  }, [activeMenu]);

  // ============ 评分记录点击 -> 跳转到对应图片 ============
  const handleScoreImageClick = useCallback((task) => {
    if (!task.file_path) return;
    const folderPath = task.file_path.substring(0, task.file_path.lastIndexOf('\\'));
    imageHook.loadImages(folderPath, 1);
    setActiveMenu('folder');
  }, [imageHook]);

  // ============ 菜单切换（统一桌面/移动端）============
  const handleMenuClick = useCallback((key) => {
    // 公共：设置子菜单项 → 弹窗
    // 设置子菜单 → 切换页面（非弹窗）
    if (key.startsWith('settings-')) {
      setActiveMenu(key);
      return;
    }

    if (!isMobile) {
      // 桌面端：切换面板/页面（toggle）
      if (key === activeMenu && activeMenu !== 'folder') {
        setActiveMenu('folder');
      } else {
        setActiveMenu(key);
      }
      return;
    }

    // 文件夹路径选择（来自 MenuDrawer 子菜单）
    if (imageHook.folders.some(f => f.path === key)) {
      handleFolderSelect(key);
      return;
    }

    // 移动端：根据菜单项类型处理
    setScoreDrawerOpen(false);
    setCaptionDrawerOpen(false);
    setMenuDrawerOpen(false);

    if (key === 'folder') {
      setActiveMenu('folder');
    } else if (key === 'scores') {
      setActiveMenu('scores');
      setScoreDrawerOpen(true);
      scoreHook.loadScoreTasks(scoreHook.scoreTaskFilter === 'all' ? null : scoreHook.scoreTaskFilter);
    } else if (key === 'captions') {
      setActiveMenu('captions');
      setCaptionDrawerOpen(true);
      captionHook.loadCaptionHistory(captionHook.captionKeyword, captionHook.captionTypeFilter);
    } else if (key === 'lut' || key === 'collections') {
      setActiveMenu(key);
    } else {
      // 其他新加的 page 类型默认行为
      setActiveMenu(key);
    }
  }, [isMobile, activeMenu, scoreHook, captionHook]);

  const handleFolderSelect = useCallback((path) => {
    imageHook.loadImages(path);
    setActiveMenu('folder');
  }, [imageHook]);

  const isPageFullScreen = activeMenu === 'lut' || activeMenu === 'collections' || activeMenu.startsWith('settings-');

  return (
    <Layout className="app-layout">
      {/* 顶部工具栏 — 合集页面全屏时隐藏 */}
      {!(isMobile && activeMenu === 'collections') && (
      <TopToolbar
        isMobile={isMobile}
        searchText=""
        onSearch={searchHook.handleSearch}
        onScan={imageHook.handleScanAll}
        onMenuClick={() => setMenuDrawerOpen(true)}
      />
      )}

      {/* 移动端抽屉 */}
      {isMobile && (
        <MenuDrawer
          open={menuDrawerOpen}
          onClose={() => setMenuDrawerOpen(false)}
          onMenuSelect={handleMenuClick}
          folders={imageHook.folders}
        />
      )}
      {isMobile && (
        <ScoreDrawer
          open={scoreDrawerOpen}
          onClose={() => setScoreDrawerOpen(false)}
          scoreTasks={scoreHook.scoreTasks}
          scoreTasksTotal={scoreHook.scoreTasksTotal}
          scoreTasksLoading={scoreHook.scoreTasksLoading}
          scoreTaskFilter={scoreHook.scoreTaskFilter}
          setScoreTaskFilter={scoreHook.setScoreTaskFilter}
          selectedIds={scoreHook.selectedScoreTaskIds}
          setSelectedIds={scoreHook.setSelectedScoreTaskIds}
          onLoadMore={() => scoreHook.loadScoreTasks(scoreHook.scoreTaskFilter === 'all' ? null : scoreHook.scoreTaskFilter, scoreHook.scoreTasksPage + 1, true)}
          onRetry={scoreHook.retryScore}
          currentPage={scoreHook.scoreTasksPage}
          onImageClick={handleScoreImageClick}
        />
      )}
      {isMobile && (
        <CaptionDrawer
          open={captionDrawerOpen}
          onClose={() => setCaptionDrawerOpen(false)}
          history={captionHook.captionHistory}
          total={captionHook.captionHistoryTotal}
          loading={captionHook.captionHistoryLoading}
          page={captionHook.captionHistoryPage}
          keyword={captionHook.captionKeyword}
          setKeyword={captionHook.setCaptionKeyword}
          typeFilter={captionHook.captionTypeFilter}
          setTypeFilter={captionHook.setCaptionTypeFilter}
          onLoad={(kw, tp) => captionHook.loadCaptionHistory(kw, tp)}
          onLoadMore={() => captionHook.loadCaptionHistory(captionHook.captionKeyword, captionHook.captionTypeFilter, captionHook.captionHistoryPage + 1, true)}
          onImageClick={(cap) => {
            const parsedIds = cap.image_ids ? JSON.parse(cap.image_ids) : [];
            captionHook.setGeneratedCaption({ ...cap, title: cap.caption_title, setType: cap.set_type, content: cap.caption_body, hashtags: cap.hashtags });
            fetchBatchImages(parsedIds).then(d => captionHook.setCaptionModalImages(d.images || [])).catch(() => captionHook.setCaptionModalImages([]));
            captionHook.setCaptionModalVisible(true);
          }}
        />
      )}
      {isMobile && activeMenu !== 'lut' && activeMenu !== 'collections' && !activeMenu.startsWith('settings-') && <BottomTabs activeMenu={activeMenu} onTabChange={handleMenuClick} failedScores={scoreHook.failedScores.length} />}

      <Layout>
        {/* 全屏页面：LUT 克隆 */}
        {activeMenu === 'lut' && (
          <div style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
            <LutPage />
          </div>
        )}

        {/* 全屏页面：照片合集 */}
        {activeMenu === 'collections' && (
          <div style={{ flex: 1, overflowY: 'hidden', width: '100%' }}>
            <CollectionPage isMobile={isMobile} onBack={() => setActiveMenu('folder')} />
          </div>
        )}

        {/* 全屏页面：模型管理 */}
        {activeMenu === 'settings-models' && (
          <div style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
            <ModelPage />
          </div>
        )}

        {/* 全屏页面：通用设置 */}
        {activeMenu === 'settings-general' && (
          <div style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
            <GeneralPage />
          </div>
        )}

        {/* 文件夹页面（含 Sider + Content + Modals） */}
        {!isPageFullScreen && (
          <FolderPage
            isMobile={isMobile}
            activeMenu={activeMenu}
            menuCollapsed={menuCollapsed}
            setMenuCollapsed={setMenuCollapsed}
            handleMenuClick={handleMenuClick}
            handleFolderSelect={handleFolderSelect}
            handleScoreImageClick={handleScoreImageClick}
            imageHook={imageHook}
            searchHook={searchHook}
            scoreHook={scoreHook}
            captionHook={captionHook}
          />
        )}
      </Layout>
    </Layout>
  );
}

export default App;
