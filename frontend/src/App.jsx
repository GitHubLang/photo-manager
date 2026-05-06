import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Select, Button, Space, Tag, Dropdown, Input, Row, Col, Divider, Popconfirm, message, Typography } from 'antd';
const { Title, Text } = Typography;
import { ThunderboltOutlined } from '@ant-design/icons';
import './App.css';

import { useImages } from './hooks/useImages';
import { useSearch } from './hooks/useSearch';
import { useScore } from './hooks/useScore';
import { useCaption } from './hooks/useCaption';

import TopToolbar from './components/layout/TopToolbar';
import SideMenu from './components/layout/SideMenu';
import BottomTabs from './components/layout/BottomTabs';
import { FolderDrawer, MenuDrawer } from './components/layout/MobileDrawers';

import ImageGrid from './components/image/ImageGrid';
import ImagePreviewModal from './components/modals/ImagePreviewModal';
import ThemeModal from './components/modals/ThemeModal';
import CaptionModal from './components/modals/CaptionModal';
import CaptionInstructionsModal from './components/modals/CaptionInstructionsModal';

import { ScoreDrawer, ScorePanel } from './components/score/ScorePanel';
import { CaptionDrawer, CaptionPanel } from './components/caption/CaptionPanel';

import SettingsModal from './components/modals/SettingsModal';
import LutPage from './pages/LutPage';
import { generateCaption as apiGenerateCaption, generateDailyTheme, createScoreTask, fetchScoreStatus, fetchScoreResults, fetchBatchImages, getProxyUrl } from './api/imageApi';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';
function getSettingModel(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

const { Sider, Content } = Layout;
const { Search } = Input;

function App() {
  // ============ 设备 & UI状态 ============
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('folder');
  const [activeMenu, setActiveMenu] = useState('folder');
  const [menuCollapsed, setMenuCollapsed] = useState(false);

  // 移动端抽屉
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [captionDrawerOpen, setCaptionDrawerOpen] = useState(false);

  // ============ 核心状态 (from hooks) ============
  const imageHook = useImages();
  const searchHook = useSearch({
    onSearchStart: () => {}
  });

  // 用 ref 避免闭包陷阱，确保 poll 里能用到最新的 updateImage
  const updateImageRef = useRef(null);
  useEffect(() => {
    updateImageRef.current = imageHook.updateImage;
  });

  const scoreHook = useScore();
  const captionHook = useCaption();

  // ============ 额外状态 ============
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [scoringIds, setScoringIds] = useState(new Set());

  // 图片预览
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  // 主题弹窗
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [dailyTheme, setDailyTheme] = useState(null);

  // 文案弹窗
  const [captionInstructionsModalVisible, setCaptionInstructionsModalVisible] = useState(false);
  const [pendingCaptionType, setPendingCaptionType] = useState('douyin');
  const captionModalImgRef = useRef([]);
  let displayImages;

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

  // ============ 评分逻辑 ============
  const handleScore = useCallback(async (imageId) => {
    const model = getSettingModel(LS_SCORING) || 'local';
    setScoringIds(prev => new Set([...prev, imageId]));
    try {
      const data = await createScoreTask([imageId], model);
      if (data.tasks?.length > 0) {
        message.success('评分任务已创建,请在图片上查看进度');
        pollScoreStatus(imageId);
      } else if (data.error?.includes('已存在')) {
        message.warning(data.error);
        setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
      } else {
        message.error('创建评分任务失败');
        setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
      }
    } catch (err) {
      message.error('评分请求失败');
      setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
    }
  }, []);

  // 用 ref 避免 poll 闭包陷阱
  const imageHookRef = useRef(imageHook);
  useEffect(() => { imageHookRef.current = imageHook; });

  const pollScoreStatus = useCallback(async (imageId, maxAttempts = 90) => {
    let attempts = 0;
    let errCount = 0;
    const poll = async () => {
      if (attempts >= maxAttempts || errCount > 30) {
        message.warning(String(imageId) + ' 评分超时，请手动重试');
        setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
        return;
      }
      attempts++;
      try {
        const status = await fetchScoreStatus(imageId);
        if (status.status === 'completed') {
          const updatedImage = await fetchScoreResults(imageId);
          if (updatedImage && updatedImage.id) {
            const hook = imageHookRef.current;
            if (hook.selectedFolder) {
              hook.loadImages(hook.selectedFolder, hook.currentPage);
            }
          }
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
          return;
        } else if (status.status === 'failed') {
          scoreHook.addFailedScore(imageId, status.error_message || '评分失败');
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
          return;
        }
        setTimeout(poll, 10000);
      } catch (err) {
        errCount++;
        setTimeout(poll, 5000);
      }
    };
    poll();
  }, [scoreHook]);

  // 批量评分
  const handleBatchScore = useCallback(async () => {
    if (selectedImages.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    const model = getSettingModel(LS_SCORING) || 'local';
    try {
      const data = await createScoreTask(selectedImages.map(img => img.id), model);
      message.success(selectedImages.length + ' 个评分任务已创建,后台处理中...');
      setSelectedImages([]);
      data.tasks?.forEach(task => {
        setScoringIds(prev => new Set([...prev, task.image_id]));
        pollScoreStatus(task.image_id);
      });
    } catch (err) {
      message.error('批量评分请求失败');
    }
  }, [selectedImages, pollScoreStatus]);

  // ============ 下载 ============
  const handleDownload = useCallback((img) => {
    const a = document.createElement('a');
    a.href = getProxyUrl(img.file_path);
    a.download = img.filename || 'image_' + img.id;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleDownloadSelected = useCallback(async () => {
    const imgs = displayImages.filter(img => selectedImages.includes(img.id));
    message.loading({ content: '正在准备 ' + imgs.length + ' 张图片...', key: 'download' });
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      try {
        const res = await fetch(getProxyUrl(img.file_path));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = img.filename || 'image_' + img.id;
        a.click();
        URL.revokeObjectURL(url);
        message.loading({ content: '下载中 ' + (i + 1) + '/' + imgs.length, key: 'download' });
      } catch (e) {
        console.error('下载失败:', img.filename, e);
      }
    }
    message.success({ content: '下载完成 ' + imgs.length + ' 张', key: 'download' });
  }, [selectedImages, displayImages]);

  // ============ 主题生成 ============
  const handleGenerateTheme = useCallback(async () => {
    if (!imageHook.selectedFolder) return;
    const folderName = imageHook.selectedFolder.split(/[/\\]/).pop();
    if (!folderName.match(/^\d{4}-\d{2}-\d{2}$/)) {
      message.warning('请选择一个日期格式的文件夹');
      return;
    }
    try {
      const data = await generateDailyTheme(folderName);
      if (data.success) {
        setDailyTheme(data);
        setThemeModalVisible(true);
      } else {
        message.error(data.error || '生成失败');
      }
    } catch (err) {
      message.error('生成主题失败');
    }
  }, [imageHook.selectedFolder]);

  // ============ 文案生成 ============
  const handleGenerateCaption = useCallback(async (setType, overrideImageIds, userInstructions) => {
    const imgIds = overrideImageIds ?? selectedImages.map(img => img.id);
    if (imgIds.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    const model = getSettingModel(LS_CAPTION) || 'local';
    const folderName = imageHook.selectedFolder?.split(/[/\\]/).pop() || '';
    try {
      const data = await apiGenerateCaption({
        date: folderName,
        imageIds: imgIds,
        setType,
        userInstructions,
        model
      });
      captionHook.removeFailedCaption(setType);
      captionHook.setGeneratedCaption({ ...data.caption, setType });
      captionHook.setCaptionModalVisible(true);
    } catch (err) {
      message.error(err.message || '生成失败');
      captionHook.addFailedCaption(setType, imgIds, err.message);
    }
  }, [selectedImages, imageHook.selectedFolder, captionHook]);

  // ============ 图片选择 ============
  const toggleSelectImage = useCallback((img) => {
    setSelectedImages(prev =>
      prev.some(item => (item.id || item) === img.id)
        ? prev.filter(item => (item.id || item) !== img.id)
        : [...prev, img]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedImages.length === displayImages.length) {
      setSelectedImages([]);
    } else {
      setSelectedImages([...displayImages]);
    }
  }, [selectedImages, displayImages]);

  // ============ 预览 ============
  const handlePreview = useCallback((img) => {
    setSelectedImage({ ...img, imageUrl: getProxyUrl(img.file_path) });
    setPreviewVisible(true);
  }, []);

  // ============ 辅助 ============
  displayImages = searchHook.searchResults !== null ? searchHook.searchResults : imageHook.images;

  const folderTreeData = imageHook.folders.map(f => ({
    title: <span>{f.name}<span style={{ marginLeft: 8 }}>{f.imageCount}</span></span>,
    key: f.path,
    path: f.path,
  }));

  // ============ 评分记录点击 -> 跳转到对应图片 ============
  const handleScoreImageClick = useCallback((task) => {
    if (!task.file_path) return;
    const folderPath = task.file_path.substring(0, task.file_path.lastIndexOf('\\'));
    imageHook.loadImages(folderPath, 1);
    setActiveMenu('folder');
  }, [imageHook]);

  // ============ Tab/菜单切换 ============
  const handleMenuClick = useCallback((key) => {
    if (key === activeMenu && activeMenu !== 'folder') {
      setActiveMenu('folder');
    } else {
      setActiveMenu(key);
    }
  }, [activeMenu]);

  const handleFolderSelect = useCallback((path) => {
    imageHook.loadImages(path);
    setSelectedImages([]);
    setActiveMenu('folder');
  }, [imageHook]);

  const handleMobileTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'folder') { setFolderDrawerOpen(false); setScoreDrawerOpen(false); setCaptionDrawerOpen(false); setMenuDrawerOpen(false); }
    if (tab === 'scores') { setScoreDrawerOpen(true); setFolderDrawerOpen(false); setCaptionDrawerOpen(false); scoreHook.loadScoreTasks(scoreHook.scoreTaskFilter === 'all' ? null : scoreHook.scoreTaskFilter); }
    if (tab === 'captions') { setCaptionDrawerOpen(true); setFolderDrawerOpen(false); setScoreDrawerOpen(false); captionHook.loadCaptionHistory(captionHook.captionKeyword, captionHook.captionTypeFilter); }
  }, [scoreHook, captionHook]);

  // ============ 操作栏按钮 ============
  const renderActionBar = () => (
    <div className="action-bar">
      <Space>
        <Text>{searchHook.searchResults !== null ? '搜索结果: ' + searchHook.searchResults.length + ' 张' : '当前: ' + imageHook.images.length + ' 张'}{imageHook.loadingMore && ' (加载更多...)'}</Text>
        {selectedImages.length > 0 && <Tag color="blue">{selectedImages.length} 张已选</Tag>}
        <Button size="small" onClick={toggleSelectAll}>
          {selectedImages.length === displayImages.length ? '取消全选' : '全选'}
        </Button>
      </Space>
      <Space>
        {!isMobile && imageHook.selectedFolder && searchHook.searchResults === null && (
          <Space size="small">
            <Button size="small" onClick={() => imageHook.goToPage(imageHook.currentPage - 1)} disabled={imageHook.currentPage <= 1}>上一页</Button>
            <Input
              size="small"
              style={{ width: 50, textAlign: 'center' }}
              defaultValue={imageHook.currentPage}
              key={imageHook.currentPage}
              onPressEnter={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= imageHook.totalPages) imageHook.goToPage(v); }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>/ {imageHook.totalPages}</Text>
            <Button size="small" onClick={() => imageHook.goToPage(imageHook.currentPage + 1)} disabled={imageHook.currentPage >= imageHook.totalPages}>下一页</Button>
          </Space>
        )}
        <Select value={imageHook.sortBy} onChange={(v) => imageHook.handleSortChange(v, imageHook.sortOrder)} style={{ width: 120 }}>
          <Select.Option value="created_at">创建时间</Select.Option>
          <Select.Option value="filename">文件名</Select.Option>
          <Select.Option value="total_score">评分</Select.Option>
          <Select.Option value="file_size">大小</Select.Option>
        </Select>
        <Select value={imageHook.sortOrder} onChange={(v) => imageHook.handleSortChange(imageHook.sortBy, v)} style={{ width: 80 }}>
          <Select.Option value="asc">升序</Select.Option>
          <Select.Option value="desc">降序</Select.Option>
        </Select>
        {!isMobile && imageHook.selectedFolder && (
          <Button icon={<ThunderboltOutlined />} onClick={handleGenerateTheme}>生成主题</Button>
        )}
        {!isMobile && (
          <>
            <Dropdown menu={{
              items: [
                ...(captionHook.failedCaptions.length > 0 ? [
                  { type: 'divider' },
                  { key: 'failed_header', label: <Text type="danger">失败记录 ({captionHook.failedCaptions.length})</Text>, disabled: true },
                  ...captionHook.failedCaptions.map(fc => ({
                    key: fc.key,
                    label: <Space size="small"><Tag color={fc.setType === 'douyin' ? 'blue' : 'green'} style={{ margin: 0 }}>{fc.setType === 'douyin' ? '抖音' : '小红书'}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{fc.time}</Text><Text type="danger" style={{ fontSize: 11 }} ellipsis title={fc.error}>{fc.error}</Text></Space>,
                    onClick: () => handleGenerateCaption(fc.setType, fc.imageIds)
                  })),
                  { key: 'retry_all', label: '全部重新生成', onClick: () => { captionHook.failedCaptions.forEach(fc => handleGenerateCaption(fc.setType, fc.imageIds)); }},
                  { type: 'divider' },
                ] : []),
                { key: 'douyin', label: '抖音文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('douyin'); setCaptionInstructionsModalVisible(true); }},
                { key: 'xiaohongshu', label: '小红书文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('xiaohongshu'); setCaptionInstructionsModalVisible(true); }}
              ]
            }}>
              <Button disabled={selectedImages.length === 0}>
                生成文案 {captionHook.failedCaptions.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{captionHook.failedCaptions.length}</Tag>}
              </Button>
            </Dropdown>
            <Dropdown menu={{
              items: [
                ...(scoreHook.failedScores.length > 0 ? [
                  { key: 'failed_header', label: <Text type="danger">评分失败 ({scoreHook.failedScores.length})</Text>, disabled: true },
                  ...scoreHook.failedScores.map((fs, idx) => ({
                    key: 'fs_' + idx,
                    label: <Space size="small"><Text style={{ fontSize: 12 }} ellipsis title={'ID: ' + fs.imageId}>{displayImages.find(i => i.id === fs.imageId)?.filename || 'ID: ' + fs.imageId}</Text><Text type="secondary" style={{ fontSize: 11 }}>{fs.time}</Text><Text type="danger" style={{ fontSize: 11 }} ellipsis>{fs.error}</Text></Space>,
                    onClick: () => handleScore(fs.imageId)
                  })),
                  { key: 'retry_all_scores', label: '全部重新评分', onClick: () => { scoreHook.failedScores.forEach(fs => handleScore(fs.imageId)); }},
                  { type: 'divider' },
                ] : []),
                { key: 'batch_score', label: selectedImages.length > 0 ? '批量评分 (' + selectedImages.length + '张)' : '批量评分', onClick: handleBatchScore, disabled: selectedImages.length === 0 }
              ]
            }}>
              <Button type="primary" icon={<ThunderboltOutlined />} disabled={selectedImages.length === 0}>
                批量评分 {scoreHook.failedScores.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{scoreHook.failedScores.length}</Tag>}
              </Button>
            </Dropdown>
          </>
        )}
      </Space>
    </div>
  );

  // ============ 移动端 FAB ============
  const FABButton = () => {
    if (!isMobile || selectedImages.length === 0) return null;
    return (
      <Dropdown menu={{ items: [
        { key: 'select_all', label: selectedImages.length === displayImages.length ? '取消全选' : '全选', onClick: toggleSelectAll },
        { key: 'download', label: '下载原图 (' + selectedImages.length + ')', onClick: handleDownloadSelected },
        { key: 'theme', label: '生成主题', onClick: handleGenerateTheme },
        { key: 'douyin', label: '抖音文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('douyin'); setCaptionInstructionsModalVisible(true); }},
        { key: 'xiaohongshu', label: '小红书文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('xiaohongshu'); setCaptionInstructionsModalVisible(true); }},
      ] }} trigger={['click']}>
        <Button className="fab-button" type="primary"><ThunderboltOutlined /></Button>
      </Dropdown>
    );
  };

  return (
    <Layout className="app-layout">
      {/* 顶部工具栏 */}
      <TopToolbar
        isMobile={isMobile}
        searchText=""
        onSearch={searchHook.handleSearch}
        onScan={imageHook.handleScanAll}
        onMenuClick={() => setMenuDrawerOpen(true)}
      />

      {/* 移动端抽屉 */}
      {isMobile && (
        <MenuDrawer
          open={menuDrawerOpen}
          onClose={() => setMenuDrawerOpen(false)}
          onMenuSelect={(key) => {
            setActiveMenu('folder');
            if (key === 'settings') { setSettingsModalVisible(true); return; }
            if (key === 'folder') { setActiveTab('folder'); setFolderDrawerOpen(true); return; }
            if (key === 'lut') { setActiveMenu('lut'); setMenuDrawerOpen(false); return; }
            handleMobileTabChange(key);
          }}
        />
      )}
      {isMobile && (
        <FolderDrawer
          open={folderDrawerOpen}
          onClose={() => setFolderDrawerOpen(false)}
          treeData={folderTreeData}
          selectedFolder={imageHook.selectedFolder}
          onSelect={(path) => { handleFolderSelect(path); setActiveTab('folder'); }}
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
      {isMobile && activeMenu !== 'lut' && <FABButton />}
      {isMobile && activeMenu !== 'lut' && <BottomTabs activeTab={activeTab} onTabChange={handleMobileTabChange} failedScores={scoreHook.failedScores.length} />}

      <Layout>
        {/* 左侧菜单（桌面端） */}
        {!isMobile && (
          <Sider width={260} collapsible collapsed={menuCollapsed} onCollapse={setMenuCollapsed} className="folder-sider">
            <SideMenu
              collapsed={menuCollapsed}
              activeMenu={activeMenu}
              folders={imageHook.folders}
              selectedFolder={imageHook.selectedFolder}
              onMenuClick={(key) => {
                if (key === 'settings') { setSettingsModalVisible(true); return; }
                handleMenuClick(key);
              }}
              onFolderSelect={handleFolderSelect}
              failedScores={scoreHook.failedScores.length}
              captionCount={captionHook.captionHistory.length}
            />
          </Sider>
        )}

        {/* PC评分面板 */}
        {!isMobile && activeMenu === 'scores' && !menuCollapsed && (
          <ScorePanel
            tasks={scoreHook.scoreTasks}
            total={scoreHook.scoreTasksTotal}
            loading={scoreHook.scoreTasksLoading}
            page={scoreHook.scoreTasksPage}
            filter={scoreHook.scoreTaskFilter}
            setFilter={scoreHook.setScoreTaskFilter}
            selectedIds={scoreHook.selectedScoreTaskIds}
            setSelectedIds={scoreHook.setSelectedScoreTaskIds}
            onLoad={(s, p) => scoreHook.loadScoreTasks(s, p)}
            onRetry={scoreHook.retryScore}
            onPageChange={() => setActiveMenu('folder')}
            onImageClick={handleScoreImageClick}
          />
        )}

        {/* PC文案面板 */}
        {!isMobile && activeMenu === 'captions' && !menuCollapsed && (
          <CaptionPanel
            history={captionHook.captionHistory}
            total={captionHook.captionHistoryTotal}
            loading={captionHook.captionHistoryLoading}
            page={captionHook.captionHistoryPage}
            keyword={captionHook.captionKeyword}
            setKeyword={captionHook.setCaptionKeyword}
            typeFilter={captionHook.captionTypeFilter}
            setTypeFilter={captionHook.setCaptionTypeFilter}
            onLoad={(kw, tp, p) => captionHook.loadCaptionHistory(kw, tp, p)}
            onPageChange={() => setActiveMenu('folder')}
            onImageClick={(cap) => {
              const parsedIds = cap.image_ids ? JSON.parse(cap.image_ids) : [];
              captionHook.setGeneratedCaption({ ...cap, title: cap.caption_title, setType: cap.set_type, content: cap.caption_body, hashtags: cap.hashtags });
              const found = parsedIds.map(id => displayImages.find(img => img.id === id)).filter(Boolean);
              if (found.length === parsedIds.length) {
                captionHook.setCaptionModalImages(found);
              } else {
                fetchBatchImages(parsedIds).then(d => captionHook.setCaptionModalImages(d.images || [])).catch(() => captionHook.setCaptionModalImages([]));
              }
              captionHook.setCaptionModalVisible(true);
            }}
          />
        )}

        {/* LUT 克隆页面 */}
        {activeMenu === 'lut' && (
          <div style={{ flex: 1, overflowY: 'auto', width: '100%' }}>
            <LutPage />
          </div>
        )}

        {/* 内容区 */}
        {activeMenu !== 'lut' && (
        <Content className="content-area" ref={imageHook.contentRef}
          onScroll={(e) => {
            const { scrollTop, scrollHeight, clientHeight } = e.target;
            if (scrollHeight - scrollTop - clientHeight < 600) {
              if (searchHook.searchResults !== null) {
                searchHook.loadMoreSearchResults();
              } else {
                imageHook.loadNextPage();
              }
            }
            if (scrollTop < 50 && imageHook.currentPage > 1 && searchHook.searchResults === null) {
              imageHook.loadPrevPage();
            }
          }}>
          {renderActionBar()}
          <ImageGrid
            images={displayImages}
            loading={searchHook.searchResults !== null ? searchHook.loading : imageHook.loading}
            selectedImages={selectedImages}
            scoringIds={scoringIds}
            onSelect={toggleSelectImage}
            onPreview={handlePreview}
            onScore={handleScore}
            onDownload={handleDownload}
          />
        </Content>
        )}
      </Layout>

      {/* 图片预览 */}
      <ImagePreviewModal
        visible={previewVisible}
        image={selectedImage}
        onClose={() => setPreviewVisible(false)}
        onScore={handleScore}
      />

      {/* 主题弹窗 */}
      <ThemeModal
        visible={themeModalVisible}
        theme={dailyTheme}
        onClose={() => setThemeModalVisible(false)}
      />

      {/* 文案说明弹窗 */}
      <CaptionInstructionsModal
        open={captionInstructionsModalVisible}
        captionType={pendingCaptionType}
        onCancel={() => setCaptionInstructionsModalVisible(false)}
        onGenerate={(inst) => {
          const imgs = captionModalImgRef.current;
          if (!imgs?.length) { message.warning('请先选择图片'); return; }
          const ids = imgs.map(img => img.id);
          setCaptionInstructionsModalVisible(false);
          handleGenerateCaption(pendingCaptionType, ids, inst);
        }}
      />

      {/* 文案结果弹窗 */}
      <CaptionModal
        visible={captionHook.captionModalVisible}
        caption={captionHook.generatedCaption}
        images={captionHook.captionModalImages}
        onClose={() => { captionHook.setCaptionModalVisible(false); captionHook.setCaptionModalImages([]); }}
        onImageClick={(img) => { setSelectedImage({ ...img, imageUrl: getProxyUrl(img.file_path) }); setPreviewVisible(true); }}
      />

      {/* 设置弹窗 */}
      <SettingsModal visible={settingsModalVisible} onClose={() => setSettingsModalVisible(false)} />
    </Layout>
  );
}

export default App;
