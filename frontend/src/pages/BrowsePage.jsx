import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select, Button, Space, Tag, Dropdown, Input, message, Typography } from 'antd';
const { Text } = Typography;
import { ThunderboltOutlined } from '@ant-design/icons';

import ImageGrid from '../components/image/ImageGrid';
import ImagePreviewModal from '../components/modals/ImagePreviewModal';
import ThemeModal from '../components/modals/ThemeModal';
import CaptionModal from '../components/modals/CaptionModal';
import CaptionInstructionsModal from '../components/modals/CaptionInstructionsModal';
import BenchmarkModal from '../components/modals/BenchmarkModal';

import {
  generateCaption as apiGenerateCaption,
  generateDailyTheme,
  createScoreTask,
  fetchScoreStatus,
  fetchScoreResults,
  fetchBatchImages,
  getProxyUrl,
} from '../api/imageApi';
import '../styles/browse.css';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';
function getSettingModel(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

/**
 * BrowsePage — 素材浏览页
 * 文件夹选择 + 图片网格 + 评分/文案/下载操作
 * PC 和移动端共享，差异走 CSS
 */
export default function BrowsePage({
  isMobile,
  imageHook, searchHook, scoreHook, captionHook,
}) {
  // ---- 本地状态 ----
  const [selectedImages, setSelectedImages] = useState([]);
  const [scoringIds, setScoringIds] = useState(new Set());
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [dailyTheme, setDailyTheme] = useState(null);
  const [benchmarkVisible, setBenchmarkVisible] = useState(false);
  const [benchmarkImage, setBenchmarkImage] = useState(null);
  const [captionInstructionsModalVisible, setCaptionInstructionsModalVisible] = useState(false);
  const [pendingCaptionType, setPendingCaptionType] = useState('douyin');
  const captionModalImgRef = useRef([]);

  const updateImageRef = useRef(null);
  useEffect(() => { updateImageRef.current = imageHook.updateImage; });

  const imageHookRef = useRef(imageHook);
  useEffect(() => { imageHookRef.current = imageHook; });

  // 切换文件夹清除选择
  useEffect(() => { setSelectedImages([]); }, [imageHook.selectedFolder]);

  // 计算显示图片
  const displayImages = searchHook.searchResults !== null
    ? searchHook.searchResults : imageHook.images;

  // ============ 评分 ============
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

  const pollScoreStatus = useCallback(async (imageId, maxAttempts = 90) => {
    let attempts = 0;
    let errCount = 0;
    const poll = async () => {
      if (attempts >= maxAttempts || errCount > 30) {
        message.warning(imageId + ' 评分超时');
        setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
        return;
      }
      attempts++;
      try {
        const status = await fetchScoreStatus(imageId);
        if (status.status === 'completed') {
          const hook = imageHookRef.current;
          if (hook.selectedFolder) hook.loadImages(hook.selectedFolder, hook.currentPage);
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
        } else if (status.status === 'failed') {
          scoreHook.addFailedScore(imageId, status.error_message || '评分失败');
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
        } else {
          setTimeout(poll, 10000);
        }
      } catch {
        errCount++;
        setTimeout(poll, 5000);
      }
    };
    poll();
  }, [scoreHook]);

  const handleBatchScore = useCallback(async () => {
    if (selectedImages.length === 0) { message.warning('请先选择图片'); return; }
    const model = getSettingModel(LS_SCORING) || 'local';
    try {
      const data = await createScoreTask(selectedImages.map(img => img.id), model);
      message.success(selectedImages.length + ' 个评分任务已创建');
      setSelectedImages([]);
      data.tasks?.forEach(task => {
        setScoringIds(prev => new Set([...prev, task.image_id]));
        pollScoreStatus(task.image_id);
      });
    } catch { message.error('批量评分请求失败'); }
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
    message.loading({ content: '正在准备...', key: 'download' });
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      try {
        const res = await fetch(getProxyUrl(img.file_path));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = img.filename || 'image_' + img.id;
        a.click(); URL.revokeObjectURL(url);
      } catch (e) { /* skip */ }
    }
    message.success({ content: '下载完成 ' + imgs.length + ' 张', key: 'download' });
  }, [selectedImages, displayImages]);

  // ============ 主题 ============
  const handleGenerateTheme = useCallback(async () => {
    if (!imageHook.selectedFolder) return;
    const folderName = imageHook.selectedFolder.split(/[/\\]/).pop();
    if (!folderName.match(/^\d{4}-\d{2}-\d{2}$/)) {
      message.warning('请选择日期格式的文件夹'); return;
    }
    try {
      const data = await generateDailyTheme(folderName);
      if (data.success) { setDailyTheme(data); setThemeModalVisible(true); }
      else message.error(data.error || '生成失败');
    } catch { message.error('生成主题失败'); }
  }, [imageHook.selectedFolder]);

  // ============ 文案 ============
  const handleGenerateCaption = useCallback(async (setType, overrideImageIds, userInstructions) => {
    const imgIds = overrideImageIds ?? selectedImages.map(img => img.id);
    if (imgIds.length === 0) { message.warning('请先选择图片'); return; }
    const model = getSettingModel(LS_CAPTION) || 'local';
    const folderName = imageHook.selectedFolder?.split(/[/\\]/).pop() || '';
    try {
      const data = await apiGenerateCaption({
        date: folderName, imageIds: imgIds, setType, userInstructions, model,
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
    if (selectedImages.length === displayImages.length) setSelectedImages([]);
    else setSelectedImages([...displayImages]);
  }, [selectedImages, displayImages]);

  // ============ 预览 ============
  const handlePreview = useCallback((img) => {
    setSelectedImage({ ...img, imageUrl: getProxyUrl(img.file_path) });
    setPreviewVisible(true);
  }, []);

  // ============ 操作栏 ============
  const renderActionBar = () => (
    <div className="action-bar">
      <Space>
        <Text>
          {searchHook.searchResults !== null
            ? '搜索结果: ' + searchHook.searchResults.length + ' 张'
            : '当前: ' + imageHook.images.length + ' 张'}
          {imageHook.loadingMore && ' (加载更多...)'}
        </Text>
        {selectedImages.length > 0 && <Tag color="blue">{selectedImages.length} 张已选</Tag>}
        <Button size="small" onClick={toggleSelectAll}>
          {selectedImages.length === displayImages.length ? '取消全选' : '全选'}
        </Button>
      </Space>
      <Space>
        {imageHook.selectedFolder && searchHook.searchResults === null && (
          <Space size="small" className="pagination-bar">
            <Button size="small" onClick={() => imageHook.goToPage(imageHook.currentPage - 1)}
              disabled={imageHook.currentPage <= 1}>上一页</Button>
            <Input size="small" style={{ width: 50, textAlign: 'center' }}
              defaultValue={imageHook.currentPage} key={imageHook.currentPage}
              onPressEnter={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= imageHook.totalPages) imageHook.goToPage(v); }} />
            <Text type="secondary" style={{ fontSize: 12 }}>/ {imageHook.totalPages}</Text>
            <Button size="small" onClick={() => imageHook.goToPage(imageHook.currentPage + 1)}
              disabled={imageHook.currentPage >= imageHook.totalPages}>下一页</Button>
          </Space>
        )}
        <Select value={imageHook.sortBy}
          onChange={(v) => imageHook.handleSortChange(v, imageHook.sortOrder)}
          style={{ width: 120 }}>
          <Select.Option value="created_at">创建时间</Select.Option>
          <Select.Option value="filename">文件名</Select.Option>
          <Select.Option value="total_score">评分</Select.Option>
          <Select.Option value="file_size">大小</Select.Option>
        </Select>
        <Select value={imageHook.sortOrder}
          onChange={(v) => imageHook.handleSortChange(imageHook.sortBy, v)}
          style={{ width: 80 }}>
          <Select.Option value="asc">升序</Select.Option>
          <Select.Option value="desc">降序</Select.Option>
        </Select>
        {imageHook.selectedFolder && (
          <Button icon={<ThunderboltOutlined />} onClick={handleGenerateTheme}>生成主题</Button>
        )}
        <Dropdown menu={{ items: buildCaptionMenu(captionHook, selectedImages, handleGenerateCaption, setPendingCaptionType, captionModalImgRef, setCaptionInstructionsModalVisible) }}>
          <Button disabled={selectedImages.length === 0}>
            生成文案 {captionHook.failedCaptions.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{captionHook.failedCaptions.length}</Tag>}
          </Button>
        </Dropdown>
        <Dropdown menu={{ items: buildScoreMenu(scoreHook, displayImages, selectedImages, handleScore, handleBatchScore) }}>
          <Button type="primary" icon={<ThunderboltOutlined />} disabled={selectedImages.length === 0}>
            批量评分 {scoreHook.failedScores.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{scoreHook.failedScores.length}</Tag>}
          </Button>
        </Dropdown>
        <Button icon={<ThunderboltOutlined />}
          onClick={() => { setBenchmarkImage(selectedImages[0]); setBenchmarkVisible(true); }}
          disabled={selectedImages.length !== 1}>
          评分测试
        </Button>
      </Space>
    </div>
  );

  // ============ 移动端 FAB (始终显示，根据是否选中展示不同菜单) ============
  const FABButton = () => (
    <Dropdown menu={{ items: buildFabMenu() }} trigger={['click']}>
      <Button className="fab-button" type="primary"><ThunderboltOutlined /></Button>
    </Dropdown>
  );

  const buildFabMenu = () => {
    const items = [];

    // 排序
    items.push({
      key: 'sort_group', label: '排序方式', type: 'group',
      children: [
        { key: 'sort_created', label: imageHook.sortBy === 'created_at' ? '✓ 创建时间' : '创建时间', onClick: () => imageHook.handleSortChange('created_at', imageHook.sortOrder) },
        { key: 'sort_name', label: imageHook.sortBy === 'filename' ? '✓ 文件名' : '文件名', onClick: () => imageHook.handleSortChange('filename', imageHook.sortOrder) },
        { key: 'sort_score', label: imageHook.sortBy === 'total_score' ? '✓ 评分' : '评分', onClick: () => imageHook.handleSortChange('total_score', imageHook.sortOrder) },
        { key: 'sort_size', label: imageHook.sortBy === 'file_size' ? '✓ 大小' : '大小', onClick: () => imageHook.handleSortChange('file_size', imageHook.sortOrder) },
      ]
    });
    items.push({
      key: 'sort_order', label: '顺序', type: 'group',
      children: [
        { key: 'order_asc', label: imageHook.sortOrder === 'asc' ? '✓ 升序' : '升序', onClick: () => imageHook.handleSortChange(imageHook.sortBy, 'asc') },
        { key: 'order_desc', label: imageHook.sortOrder === 'desc' ? '✓ 降序' : '降序', onClick: () => imageHook.handleSortChange(imageHook.sortBy, 'desc') },
      ]
    });

    // 选择操作（仅当选中有图片时）
    if (selectedImages.length > 0) {
      items.push({ type: 'divider' });
      items.push({ key: 'selected_count', label: '已选 ' + selectedImages.length + ' 张', disabled: true });
      items.push({ key: 'select_all', label: selectedImages.length === displayImages.length ? '取消全选' : '全选', onClick: toggleSelectAll });
      items.push({ key: 'download', label: '下载原图 (' + selectedImages.length + ')', onClick: handleDownloadSelected });
      items.push({ key: 'batch_score', label: '批量评分 (' + selectedImages.length + ')', onClick: handleBatchScore });
      items.push({ key: 'douyin', label: '抖音文案', onClick: () => { captionModalImgRef.current = selectedImages; setPendingCaptionType('douyin'); setCaptionInstructionsModalVisible(true); } });
      items.push({ key: 'xiaohongshu', label: '小红书文案', onClick: () => { captionModalImgRef.current = selectedImages; setPendingCaptionType('xiaohongshu'); setCaptionInstructionsModalVisible(true); } });
      items.push({ key: 'theme', label: '生成主题', onClick: handleGenerateTheme });
    }

    // 翻页（仅当在文件夹浏览时）
    if (imageHook.selectedFolder && searchHook.searchResults === null) {
      items.push({ type: 'divider' });
      items.push({ key: 'page_info', label: '第 ' + imageHook.currentPage + ' / ' + imageHook.totalPages + ' 页', disabled: true });
      items.push({ key: 'prev_page', label: '上一页', disabled: imageHook.currentPage <= 1, onClick: () => imageHook.goToPage(imageHook.currentPage - 1) });
      items.push({ key: 'next_page', label: '下一页', disabled: imageHook.currentPage >= imageHook.totalPages, onClick: () => imageHook.goToPage(imageHook.currentPage + 1) });
    }

    return items;
  };

  // ============ 渲染 ============
  return (
    <>
      <div className="page-content"
        ref={imageHook.contentRef}
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.target;
          if (scrollHeight - scrollTop - clientHeight < 600) {
            if (searchHook.searchResults !== null) searchHook.loadMoreSearchResults();
            else imageHook.loadNextPage();
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
      </div>

      <ImagePreviewModal
        visible={previewVisible}
        isMobile={isMobile}
        image={selectedImage}
        onClose={() => setPreviewVisible(false)}
        onScore={handleScore}
      />

      <ThemeModal
        visible={themeModalVisible}
        theme={dailyTheme}
        onClose={() => setThemeModalVisible(false)}
      />

      <CaptionInstructionsModal
        open={captionInstructionsModalVisible}
        captionType={pendingCaptionType}
        onCancel={() => setCaptionInstructionsModalVisible(false)}
        onGenerate={(inst) => {
          const imgs = captionModalImgRef.current;
          if (!imgs?.length) { message.warning('请先选择图片'); return; }
          setCaptionInstructionsModalVisible(false);
          handleGenerateCaption(pendingCaptionType, imgs.map(img => img.id), inst);
        }}
      />

      <CaptionModal
        visible={captionHook.captionModalVisible}
        caption={captionHook.generatedCaption}
        images={captionHook.captionModalImages}
        onClose={() => { captionHook.setCaptionModalVisible(false); captionHook.setCaptionModalImages([]); }}
        onImageClick={(img) => { setSelectedImage({ ...img, imageUrl: getProxyUrl(img.file_path) }); setPreviewVisible(true); }}
      />

      <BenchmarkModal
        visible={benchmarkVisible}
        image={benchmarkImage}
        onClose={() => { setBenchmarkVisible(false); setBenchmarkImage(null); }}
      />

      {isMobile && !previewVisible && FABButton()}
    </>
  );
}

// ============ 菜单构建 helpers ============

function buildCaptionMenu(captionHook, selectedImages, handleGenerateCaption, setPendingCaptionType, captionModalImgRef, setCaptionInstructionsModalVisible) {
  const items = [];
  if (captionHook.failedCaptions.length > 0) {
    items.push(
      { type: 'divider' },
      { key: 'failed_header', label: <Text type="danger">失败记录 ({captionHook.failedCaptions.length})</Text>, disabled: true },
      ...captionHook.failedCaptions.map(fc => ({
        key: fc.key,
        label: <Space size="small"><Tag color={fc.setType === 'douyin' ? 'blue' : 'green'} style={{ margin: 0 }}>{fc.setType === 'douyin' ? '抖音' : '小红书'}</Tag><Text type="secondary" style={{ fontSize: 11 }}>{fc.time}</Text><Text type="danger" style={{ fontSize: 11 }} ellipsis>{fc.error}</Text></Space>,
        onClick: () => handleGenerateCaption(fc.setType, fc.imageIds),
      })),
      { key: 'retry_all', label: '全部重新生成', onClick: () => captionHook.failedCaptions.forEach(fc => handleGenerateCaption(fc.setType, fc.imageIds)) },
      { type: 'divider' },
    );
  }
  items.push(
    { key: 'douyin', label: '抖音文案', onClick: () => { captionModalImgRef.current = selectedImages; setPendingCaptionType('douyin'); setCaptionInstructionsModalVisible(true); } },
    { key: 'xiaohongshu', label: '小红书文案', onClick: () => { captionModalImgRef.current = selectedImages; setPendingCaptionType('xiaohongshu'); setCaptionInstructionsModalVisible(true); } },
  );
  return items;
}

function buildScoreMenu(scoreHook, displayImages, selectedImages, handleScore, handleBatchScore) {
  const items = [];
  if (scoreHook.failedScores.length > 0) {
    items.push(
      { key: 'failed_header', label: <Text type="danger">评分失败 ({scoreHook.failedScores.length})</Text>, disabled: true },
      ...scoreHook.failedScores.map((fs, idx) => ({
        key: 'fs_' + idx,
        label: <Space size="small"><Text style={{ fontSize: 12 }} ellipsis>{displayImages.find(i => i.id === fs.imageId)?.filename || 'ID: ' + fs.imageId}</Text><Text type="secondary" style={{ fontSize: 11 }}>{fs.time}</Text><Text type="danger" style={{ fontSize: 11 }} ellipsis>{fs.error}</Text></Space>,
        onClick: () => handleScore(fs.imageId),
      })),
      { key: 'retry_all_scores', label: '全部重新评分', onClick: () => scoreHook.failedScores.forEach(fs => handleScore(fs.imageId)) },
      { type: 'divider' },
    );
  }
  items.push({ key: 'batch_score', label: selectedImages.length > 0 ? '批量评分 (' + selectedImages.length + '张)' : '批量评分', onClick: handleBatchScore, disabled: selectedImages.length === 0 });
  return items;
}
