import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Input, Card, Row, Col, Spin, Empty, Button, Dropdown, Modal, message, Tabs, Tag, Select, Space, Typography, Image, Divider, Tooltip, Menu, Checkbox, Popconfirm } from 'antd';
import { FolderOutlined, FileImageOutlined, SearchOutlined, ScanOutlined, SettingOutlined, CameraOutlined, ThunderboltOutlined, MessageOutlined, CopyOutlined, CheckOutlined, StarOutlined, FileTextOutlined, MenuOutlined, DownloadOutlined } from '@ant-design/icons';
import './App.css';

const { Sider, Content } = Layout;
const { Search, TextArea } = Input;
const { Title, Text } = Typography;

const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000/api`;

// 文案自定义要求弹窗（独立组件，避免父组件1400行重渲染导致输入卡顿）
function CaptionInstructionsModal({ open, captionType, imageIds, onCancel, onGenerate }) {
  const [instructions, setInstructions] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 弹窗打开时拉取历史
  useEffect(() => {
    if (!open) return;
    setLoadingHistory(true);
    fetch(`${API_BASE}/instruction-history?set_type=${captionType}`)
      .then(r => r.json())
      .then(data => {
        setHistory(data.history || []);
        setLoadingHistory(false);
      })
      .catch(() => setLoadingHistory(false));
  }, [open, captionType]);

  const handleOk = () => {
    const text = instructions.trim();
    // 有输入才存历史
    if (text) {
      fetch(`${API_BASE}/instruction-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: text, set_type: captionType })
      });
    }
    onGenerate(text);
    setInstructions('');
  };

  const handleCancel = () => {
    setInstructions('');
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={`生成${captionType === 'douyin' ? '抖音' : '小红书'}文案 - 添加自定义要求`}
      okText="生成"
      cancelText="取消"
      onOk={handleOk}
      width={500}
      centered
    >
      <p style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
        {captionType === 'douyin' ? '抖音' : '小红书'}文案 - 可选填写自定义要求
      </p>
      <Select
        placeholder="从历史记录中选择，或直接填写"
        allowClear
        showSearch
        listHeight={500}
        filterOption={(input, option) =>
          option.children.props.children[1]?.props?.children?.toLowerCase().includes(input.toLowerCase())
        }
        loading={loadingHistory}
        style={{ width: '100%', marginBottom: 8 }}
        onChange={(val) => setInstructions(val || '')}
        dropdownStyle={{ maxHeight: 'none' }}
      >
        {history.map(item => (
          <Select.Option key={item.id} value={item.instruction}>
            <div style={{ padding: '2px 0', wordBreak: 'break-all' }}>
              <Tag color={item.set_type === 'douyin' ? 'blue' : 'green'} style={{ marginRight: 6 }}>
                {item.set_type === 'douyin' ? '抖音' : '小红书'}
              </Tag>
              {item.instruction}
            </div>
          </Select.Option>
        ))}
      </Select>
      <Input.TextArea
        rows={3}
        value={instructions}
        onChange={e => setInstructions(e.target.value)}
        placeholder="例如：接地气口语化 / 文艺小清新风格 / 突出摄影技术 / 不要emoji"
      />
    </Modal>
  );
}


function App() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [selectedModel, setSelectedModel] = useState('local');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [dailyTheme, setDailyTheme] = useState(null);
  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [captionInstructionsModalVisible, setCaptionInstructionsModalVisible] = useState(false);
  const [pendingCaptionType, setPendingCaptionType] = useState('douyin');
  const [generatedCaption, setGeneratedCaption] = useState(null);
  const [captionModalImages, setCaptionModalImages] = useState([]);  // 文案详情弹窗中的图片列表
  const [selectedImages, setSelectedImages] = useState([]);
  const [failedCaptions, setFailedCaptions] = useState([]);
  const [failedScores, setFailedScores] = useState([]);
  // 搜索防抖
  const searchTimerRef = useRef(null);
  // 正在评分的图片ID集合
  const scoringRef = useRef(new Set());
  // 用于触发UI更新的state
  const [scoringVersion, setScoringVersion] = useState(0);
  const [sortBy, setSortBy] = useState('filename');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);

  // 左侧菜单
  const [activeMenu, setActiveMenu] = useState('folder');
  const [currentMenuKey, setCurrentMenuKey] = useState('folder');
  const [menuCollapsed, setMenuCollapsed] = useState(false);

  // 评分记录
  const [scoreTasks, setScoreTasks] = useState([]);
  const [scoreTasksTotal, setScoreTasksTotal] = useState(0);
  const [scoreTasksPage, setScoreTasksPage] = useState(1);
  const [scoreTasksLoading, setScoreTasksLoading] = useState(false);
  const [scoreTaskFilter, setScoreTaskFilter] = useState('all');
  const [selectedScoreTaskIds, setSelectedScoreTaskIds] = useState([]);

  // 文案记录
    useEffect(() => {
    // Sync currentMenuKey with activeMenu for panel visibility
    if (activeMenu !== 'folder') {
      setCurrentMenuKey(activeMenu);
    }
  }, [activeMenu]);

  // When scores panel opens, fetch tasks
  useEffect(() => {
    if (activeMenu === 'scores') {
      fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter);
    }
  }, [activeMenu]);

  const [captionHistory, setCaptionHistory] = useState([]);
  const [captionHistoryTotal, setCaptionHistoryTotal] = useState(0);
  const [captionHistoryPage, setCaptionHistoryPage] = useState(1);
  const [captionHistoryLoading, setCaptionHistoryLoading] = useState(false);
  const [captionKeyword, setCaptionKeyword] = useState('');
  const [captionTypeFilter, setCaptionTypeFilter] = useState(null);

  // 移动端状态
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('folder');
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);
  const [scoreDrawerOpen, setScoreDrawerOpen] = useState(false);
  const [captionDrawerOpen, setCaptionDrawerOpen] = useState(false);

  // 内容区 ref（用于双向滚动加载和位置恢复）
  const contentRef = useRef(null);
  const captionScrollRef = useRef(null);
  const scoreScrollRef = useRef(null);
  const captionModalImgRef = useRef([]);
  // 已加载的页号集合（用 Set 追踪哪些页已加载，防止重复）
  const loadedPagesSet = useRef(new Set());
  // 正在加载的页号（防止 API 返回前重复触发加载）
  const loadingPagesSet = useRef(new Set());
  // 是否处于恢复模式
  const isRestoringRef = useRef(false);
  // 滚动事件是否正在处理中（防止抖动）
  const scrollBusyRef = useRef(false);

  // 加载目录树和模型列表
  useEffect(() => {
    fetchFolders();
    fetchModels();
  }, []);

  // 移动端检测
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 加载上次浏览位置(fetchFolders 完成后调用)
  const fetchAppState = async (currentFolders) => {
    try {
      const res = await fetch(`${API_BASE}/app-state`);
      const data = await res.json();
      if (data.last_folder_path) {
        // 统一用反斜杠分割取文件夹名进行匹配（避免路径格式差异）
        const folderName = data.last_folder_path.split(/[/\\]/).pop();
        const matched = currentFolders.find(f => f.path.split(/[/\\]/).pop() === folderName);
        if (matched) {
          const savedPage = data.last_page || 1;
          const savedSortBy = data.last_sort_by || 'filename';
          const savedSortOrder = data.last_sort_order || 'asc';
          const savedScrollTop = data.last_scroll_top || 0;
          setSortBy(savedSortBy);
          setSortOrder(savedSortOrder);
          // 加载到目标页，然后滚动到保存的位置
          isRestoringRef.current = true;
          loadImages(matched.path, savedPage, false, savedScrollTop);
        }
      }
    } catch (err) {
      console.error('加载浏览位置失败');
    }
  };

  // 保存浏览位置
  const saveAppState = async (folderPath, page = 1) => {
    const scrollTop = contentRef.current ? contentRef.current.scrollTop : 0;
    try {
      await fetch(`${API_BASE}/app-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          last_folder_path: folderPath,
          last_page: page,
          last_sort_by: sortBy,
          last_sort_order: sortOrder,
          last_scroll_top: scrollTop
        })
      });
    } catch (err) {
      console.error('保存浏览位置失败');
    }
  };

  // 获取评分记录
  const fetchScoreTasks = async (status, page = 1, append = false) => {
    if (page > 1) setScoreTasksLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: 20 });
      if (status && status !== 'all') params.set('status', status);
      const res = await fetch(`${API_BASE}/score-tasks?${params}`);
      const data = await res.json();
      console.log("[SCORE API] fetched", (data.tasks||[]).length, "tasks, total:", data.total, "status:", res.status);
      setScoreTasks(prev => append ? [...prev, ...(data.tasks || [])] : (data.tasks || []));
      setScoreTasksTotal(data.total || 0);
      setScoreTasksPage(page);
    } catch (err) {
      if (append) message.error('加载更多评分记录失败');
    } finally {
      if (page > 1) setScoreTasksLoading(false);
    }
  };

  // 重试评分
  const retryScoreTasks = async (imageIds) => {
    if (!imageIds || imageIds.length === 0) return;
    try {
      await fetch(`${API_BASE}/score-tasks/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageIds)
      });
      message.success(`已提交 ${imageIds.length} 个评分任务`);
      setSelectedScoreTaskIds([]);
      fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter);
    } catch (err) {
      message.error('重试失败');
    }
  };

  // 获取文案记录
  const fetchCaptionHistory = async (keyword, setType, page = 1, append = false) => {
    if (page > 1) setCaptionHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page, page_size: 20 });
      if (keyword) params.set('keyword', keyword);
      if (setType) params.set('set_type', setType);
      const res = await fetch(`${API_BASE}/caption/history?${params}`);
      const data = await res.json();
      setCaptionHistory(prev => append ? [...prev, ...(data.captions || [])] : (data.captions || []));
      setCaptionHistoryTotal(data.total || 0);
      setCaptionHistoryPage(page);
    } catch (err) {
      if (append) message.error('加载更多文案记录失败');
    } finally {
      if (page > 1) setCaptionHistoryLoading(false);
    }
  };

  // 获取可用模型列表
  const fetchModels = async () => {
    try {
      const res = await fetch(`${API_BASE}/models`);
      const data = await res.json();
      setAvailableModels(data.models || []);
    } catch (err) {
      console.error('加载模型列表失败');
    }
  };

  const fetchFolders = async () => {
    try {
      const res = await fetch(`${API_BASE}/folders`);
      const data = await res.json();
      const folderList = data.folders || [];
      setFolders(folderList);
      // 文件夹加载完成后恢复上次浏览位置
      fetchAppState(folderList);
    } catch (err) {
      message.error('加载目录失败');
    }
  };

  // 扫描所有文件夹
  const handleScanAll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/folders/scan-all`, { method: 'POST' });
      const data = await res.json();
      message.success(`扫描完成:新增 ${data.added} 张,跳过 ${data.skipped} 张`);
      if (selectedFolder) {
        loadImages(selectedFolder);
      }
      fetchFolders();
    } catch (err) {
      message.error('扫描失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载文件夹图片
  // restoreScroll: 可选，刷新恢复时滚动到此像素位置
  const loadImages = async (folderPath, page = 1, append = false, restoreScroll = null) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setSearchResults(null);
    try {
      const params = new URLSearchParams({
        page: page,
        page_size: 50,
        sort_by: sortBy,
        sort_order: sortOrder
      });
      const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(folderPath)}/images?${params}`);
      const data = await res.json();

      if (append) {
        setImages(prev => [...prev, ...(data.images || [])]);
        // 追踪已加载的页号
        loadedPagesSet.current.add(data.page);
        // 标记加载完成
        loadingPagesSet.current.delete(data.page);
      } else {
        setImages(data.images || []);
        // 普通加载（切换文件夹），重置
        loadedPagesSet.current = new Set([data.page]);
        loadingPagesSet.current.clear();
      }
      setCurrentPage(data.page);
      setTotalPages(data.total_pages);
      setSelectedFolder(folderPath);
      // 恢复模式不保存，让 fetchAppState 统一保存
      if (!isRestoringRef.current) {
        saveAppState(folderPath, page);
      }
    } catch (err) {
      message.error('加载图片失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      // API 完成后解锁滚动
      scrollBusyRef.current = false;
      // 恢复模式保存
      if (isRestoringRef.current) {
        isRestoringRef.current = false;
        saveAppState(folderPath, page);
      }
    }
  };

  // 加载下一页（向下滚到底部触发）
  const loadNextPage = () => {
    if (isRestoringRef.current || scrollBusyRef.current) return;
    if (searchResults !== null) return;  // 搜索模式下不加载
    if (loadedPagesSet.current.has(totalPages)) return;
    let nextPage = currentPage + 1;
    while ((loadedPagesSet.current.has(nextPage) || loadingPagesSet.current.has(nextPage)) && nextPage <= totalPages) {
      nextPage++;
    }
    if (nextPage > totalPages) return;
    scrollBusyRef.current = true;
    loadingPagesSet.current.add(nextPage);
    requestAnimationFrame(() => {
      loadImages(selectedFolder, nextPage, true);
    });
  };

  // 加载上一页（向上滚到顶部触发）
  const loadPrevPage = () => {
    if (isRestoringRef.current || scrollBusyRef.current) return;
    if (searchResults !== null) return;  // 搜索模式下不加载
    if (loadedPagesSet.current.has(1)) return;
    let prevPage = currentPage - 1;
    while ((loadedPagesSet.current.has(prevPage) || loadingPagesSet.current.has(prevPage)) && prevPage > 1) {
      prevPage--;
    }
    if (prevPage < 1) return;
    scrollBusyRef.current = true;
    loadingPagesSet.current.add(prevPage);
    requestAnimationFrame(() => {
      loadImagesPrev(prevPage);
    });
  };

  // 加载指定页并追加到列表前面（用于向上翻页）
  const loadImagesPrev = async (page) => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        page: page,
        page_size: 50,
        sort_by: sortBy,
        sort_order: sortOrder
      });
      const res = await fetch(`${API_BASE}/folders/${encodeURIComponent(selectedFolder)}/images?${params}`);
      const data = await res.json();
      if (data.images) {
        const contentEl = contentRef.current;
        // 测量 prepend 前可视区域底部距内容底部的距离
        const scrollTopBefore = contentEl ? contentEl.scrollTop : 0;
        const clientHeight = contentEl ? contentEl.clientHeight : 0;
        const scrollHeightBefore = contentEl ? contentEl.scrollHeight : 0;
        const bottomBoundary = scrollHeightBefore - scrollTopBefore - clientHeight;
        
        setImages(prev => [...(data.images), ...prev]);
        setCurrentPage(page);
        loadedPagesSet.current.add(data.page);
        saveAppState(selectedFolder, page);
        
        // DOM 更新后，用相同的底部边界恢复滚动位置
        requestAnimationFrame(() => {
          if (contentEl) {
            const scrollHeightAfter = contentEl.scrollHeight;
            const newScrollTop = Math.max(0, scrollHeightAfter - clientHeight - bottomBoundary);
            contentEl.scrollTop = newScrollTop;
          }
        });
      }
    } catch (err) {
      console.error('加载上一页失败', err);
    } finally {
      setLoadingMore(false);
      scrollBusyRef.current = false;
    }
  };

  // 搜索图片（防抖）
  const handleSearch = async (value) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setSearchResults(null);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(value)}&page=1&page_size=100`);
        const data = await res.json();
        setSearchResults(data.images || []);
      } catch (err) {
        message.error('搜索失败');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  // 评分图片(异步,不等待结果)
  const handleScore = async (imageId) => {
    scoringRef.current.add(imageId);
    setScoringVersion(v => v + 1);  // 触发UI更新显示"评分中"
    try {
      const res = await fetch(`${API_BASE}/images/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ids: [imageId], model: selectedModel })
      });
      const data = await res.json();
      if (data.tasks?.length > 0) {
        message.success('评分任务已创建,请在图片上查看进度');
        // 开始轮询状态
        pollScoreStatus(imageId);
      } else if (data.error?.includes('已存在')) {
        message.warning(data.error);
        // 已存在的情况下也要清理
        scoringRef.current.delete(imageId);
        setScoringVersion(v => v + 1);
      } else {
        message.error('创建评分任务失败');
        scoringRef.current.delete(imageId);
        setScoringVersion(v => v + 1);
      }
    } catch (err) {
      message.error('评分请求失败');
      scoringRef.current.delete(imageId);
      setScoringVersion(v => v + 1);
    }
  };

  // 轮询评分状态
  const pollScoreStatus = async (imageId, maxAttempts = 60) => {
    let attempts = 0;
    const poll = async () => {
      if (attempts >= maxAttempts) return;
      attempts++;

      try {
        const res = await fetch(`${API_BASE}/images/score/status/${imageId}`);
        const status = await res.json();

        if (status.status === 'completed') {
          // 评分完成,直接更新这张图的分数到页面
          fetch(`${API_BASE}/images/score/results/${imageId}`)
            .then(res => res.json())
            .then(updatedImage => {
              if (updatedImage && updatedImage.id) {
                setImages(prev => prev.map(img => 
                  img.id === imageId ? { ...img, ...updatedImage } : img
                ));
              }
            })
            .finally(() => {
              // 清理评分中状态
              scoringRef.current.delete(imageId);
              setScoringVersion(v => v + 1);
            });
          return;
        } else if (status.status === 'failed') {
          message.error(`评分失败: ${status.error_message}`);
          setFailedScores(prev => [{
            imageId,
            error: status.error_message || '评分失败',
            time: new Date().toLocaleTimeString()
          }, ...prev].slice(0, 20));
          scoringRef.current.delete(imageId);
          setScoringVersion(v => v + 1);
          return;
        }

        // 继续轮询
        setTimeout(poll, 10000);
      } catch (err) {
        // 忽略错误,继续轮询
        setTimeout(poll, 5000);
      }
    };

    poll();
  };

  // 批量评分(异步)
  const handleBatchScore = async () => {
    if (selectedImages.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/images/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_ids: selectedImages, model: selectedModel })
      });
      const data = await res.json();
      message.success(`${selectedImages.length} 个评分任务已创建,后台处理中...`);

      // 开始轮询所有任务的完成状态
      setSelectedImages([]);
      data.tasks?.forEach(task => {
        pollScoreStatus(task.image_id);
      });
    } catch (err) {
      message.error('批量评分请求失败');
    }
  };

  // 下载选中的原图
  const handleDownloadOriginal = async () => {
    if (selectedImages.length === 0) return;
    const imgs = displayImages.filter(img => selectedImages.includes(img.id));
    message.loading({ content: `正在准备 ${imgs.length} 张图片...`, key: 'download' });
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i];
      try {
        const res = await fetch(`${API_BASE}/image/proxy/${encodeURIComponent(img.file_path)}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = img.filename || `image_${img.id}`;
        a.click();
        URL.revokeObjectURL(url);
        message.loading({ content: `下载中 ${i + 1}/${imgs.length}`, key: 'download' });
      } catch (e) {
        console.error('下载失败:', img.filename, e);
      }
    }
    message.success({ content: `下载完成 ${imgs.length} 张`, key: 'download' });
  };

  // 生成每日主题
  const handleGenerateTheme = async () => {
    if (!selectedFolder) return;
    // 从路径提取日期
    const folderName = selectedFolder.split(/[/\\]/).pop();
    if (!folderName.match(/^\d{4}-\d{2}-\d{2}$/)) {
      message.warning('请选择一个日期格式的文件夹');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/daily-theme/${folderName}/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setDailyTheme(data);
        setThemeModalVisible(true);
      } else {
        message.error(data.error || '生成失败');
      }
    } catch (err) {
      message.error('生成主题失败');
    } finally {
      setLoading(false);
    }
  };

  // 生成文案
  const handleGenerateCaption = async (setType, overrideImageIds, userInstructions) => {
    const imgIds = overrideImageIds ?? selectedImages.map(img => img.id);
    if (imgIds.length === 0) {
      message.warning('请先选择图片');
      return;
    }
    const folderName = selectedFolder?.split(/[/\\]/).pop() || '';
    setLoading(true);
    try {
      const cleanIds = (Array.isArray(imgIds) ? imgIds : []).map(x => parseInt(x, 10)).filter(x => !isNaN(x));
      if (cleanIds.length === 0) {
        message.warning('未选择有效图片');
        setLoading(false);
        return;
      }
      const payload = {
          date: String(folderName || ''),
          image_ids: cleanIds,
          set_type: String(setType || 'douyin'),
          user_instructions: userInstructions ? String(userInstructions) : null
        };
      const res = await fetch(`${API_BASE}/caption/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        const rawDetail = data.detail;
        const errMsg = Array.isArray(rawDetail)
          ? rawDetail.map(e => (e && typeof e === 'object' ? (e.msg ? String(e.msg) : JSON.stringify(e)) : String(e))).join('; ')
          : String(rawDetail || data.error || `请求失败 (${res.status})`);
        try { message.error(errMsg); } catch(e) { message.error(`请求失败 (${res.status})`); }
        setFailedCaptions(prev => [{
          key: `${setType}_${Date.now()}`,
          setType,
          imageIds: [...imgIds],
          error: errMsg,
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 10));
      } else if (data.success && data.caption) {
        // 成功后从失败列表移除同类型
        setFailedCaptions(prev => prev.filter(fc => fc.setType !== setType));
        setGeneratedCaption({ ...data.caption, setType });
        setCaptionModalVisible(true);
      } else {
        const errMsg = data.error || '生成失败,请检查是否已评分的图片';
        message.error(errMsg);
        setFailedCaptions(prev => [{
          key: `${setType}_${Date.now()}`,
          setType,
          imageIds: [...imgIds],
          error: errMsg,
          time: new Date().toLocaleTimeString()
        }, ...prev].slice(0, 10));
      }
    } catch (err) {
      message.error('网络错误,请检查后端服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  // 目录树数据转换
  const treeData = folders.map(f => ({
    title: (
      <span>
        <FolderOutlined /> {f.name}
        <Tag style={{ marginLeft: 8 }}>{f.imageCount}</Tag>
      </span>
    ),
    key: f.path,
    path: f.path,
    date: f.date,
    imageCount: f.imageCount
  }));

  // 图片列表(搜索结果或文件夹图片)
  const displayImages = searchResults !== null ? searchResults : images;

  const getScoreColor = (score) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    if (score >= 40) return '#faad14';
    return '#f5222d';
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  // 移动端底部 Tab 栏
  const BottomTabBar = () => (
    <div className="bottom-tabs">
      <div className="bottom-tabs-inner">
        <button className={`bottom-tab-item ${activeTab === 'folder' ? 'active' : ''}`} onClick={() => { setActiveTab('folder'); setFolderDrawerOpen(false); setScoreDrawerOpen(false); setCaptionDrawerOpen(false); }}>
          <FolderOutlined />
          <span>文件夹</span>
        </button>
        <button className={`bottom-tab-item ${activeTab === 'scores' ? 'active' : ''}`} onClick={() => { setActiveTab('scores'); setScoreDrawerOpen(true); setFolderDrawerOpen(false); setCaptionDrawerOpen(false); fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter); }}>
          <StarOutlined />
          <span>评分</span>
          {failedScores.length > 0 && <span className="tab-badge">{failedScores.length}</span>}
        </button>
        <button className={`bottom-tab-item ${activeTab === 'captions' ? 'active' : ''}`} onClick={() => { setActiveTab('captions'); setCaptionDrawerOpen(true); setFolderDrawerOpen(false); setScoreDrawerOpen(false); fetchCaptionHistory(captionKeyword, captionTypeFilter); }}>
          <FileTextOutlined />
          <span>文案</span>
        </button>
      </div>
    </div>
  );

  // 文件夹抽屉
  const FolderDrawer = () => (
    <div className={`folder-drawer ${folderDrawerOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setFolderDrawerOpen(false); }}>
      <div className="folder-drawer-backdrop" onClick={() => setFolderDrawerOpen(false)} />
      <div className="folder-drawer-panel">
        <div className="folder-drawer-header">
          <Text strong>选择文件夹</Text>
          <Button type="text" size="small" onClick={() => setFolderDrawerOpen(false)}>关闭</Button>
        </div>
        <div className="folder-drawer-content">
          <Tree treeData={treeData} selectedKeys={selectedFolder ? [selectedFolder] : []} onSelect={(keys, info) => { if (info.node.path) { loadImages(info.node.path); setSelectedImages([]); setActiveTab('folder'); setFolderDrawerOpen(false); } }} showIcon={false} />
        </div>
      </div>
    </div>
  );

  // 评分抽屉
  const ScoreDrawer = () => (
    <div className={`score-panel ${scoreDrawerOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setScoreDrawerOpen(false); }}>
      <div className="score-panel-backdrop" onClick={() => setScoreDrawerOpen(false)} />
      <div className="score-panel-content">
        <div className="folder-drawer-header">
          <Text strong>评分记录</Text>
          <Button type="text" size="small" onClick={() => setScoreDrawerOpen(false)}>关闭</Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }} ref={scoreScrollRef} onScroll={e => { const el = e.target; const { scrollTop, scrollHeight, clientHeight } = el; if (scrollHeight - scrollTop - clientHeight < 100 && !scoreTasksLoading && scoreTasks.length < scoreTasksTotal) { const prevHeight = scrollHeight; fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter, scoreTasksPage + 1, true).then(() => { requestAnimationFrame(() => { el.scrollTop = scrollTop + (el.scrollHeight - prevHeight); }); }); } }}>
          <Space style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            <Select value={scoreTaskFilter} onChange={(v) => { setScoreTaskFilter(v); fetchScoreTasks(v === 'all' ? null : v); }} style={{ width: 90 }} size="small" popupMatchSelectWidth={false} styles={{ popup: { root: { position: 'fixed', zIndex: 1300 } }}}>
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
            <Button size="small" disabled={selectedScoreTaskIds.length === 0} onClick={() => retryScoreTasks(selectedScoreTaskIds)}>重试({selectedScoreTaskIds.length})</Button>
          </Space>
          <Spin spinning={scoreTasksLoading}>
            {scoreTasks.length === 0 ? <Empty description="暂无记录" /> : scoreTasks.map(task => (
                <Card key={String(task.id)} size="small" hoverable style={{ marginBottom: 8, opacity: String(task.status ?? '') === 'completed' ? 0.6 : 1 }}
                cover={task.file_path ? <img src={`${API_BASE}/image/thumbnail/${encodeURIComponent(String(task.file_path))}?size=100`} alt={String(task.filename ?? '')} style={{ height: 60, objectFit: 'cover' }} /> : null}
                onClick={() => { if (String(task.status ?? '') !== 'completed') setSelectedScoreTaskIds(prev => prev.includes(Number(task.image_id)) ? prev.filter(id => id !== Number(task.image_id)) : [...prev, Number(task.image_id)]); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {String(task.status ?? '') !== 'completed' && <Checkbox checked={selectedScoreTaskIds.includes(Number(task.image_id))} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text ellipsis style={{ fontSize: 12 }}>{String(task.filename ?? '') || `ID:${Number(task.image_id) || 0}`}</Text>
                    <Tag color={String(task.status ?? '') === 'failed' ? 'red' : String(task.status ?? '') === 'completed' ? 'green' : 'orange'} style={{ fontSize: 10 }}>{String(task.status ?? '') === 'processing' ? '处理中' : String(task.status ?? '') === 'failed' ? '失败' : String(task.status ?? '')}</Tag>
                  </div>
                  {String(task.status ?? '') !== 'completed' && <Button size="small" onClick={(e) => { e.stopPropagation(); retryScoreTasks([Number(task.image_id)]); }}>重试</Button>}
                </div>
              </Card>
            ))}
          </Spin>
        </div>
      </div>
    </div>
  );

  // 文案抽屉
  const CaptionDrawer = () => (
    <div className={`caption-panel ${captionDrawerOpen ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setCaptionDrawerOpen(false); }}>
      <div className="caption-panel-backdrop" onClick={() => setCaptionDrawerOpen(false)} />
      <div className="caption-panel-content">
        <div className="folder-drawer-header caption-panel-header">
          <Text strong>文案记录</Text>
          <Button type="text" size="small" onClick={() => setCaptionDrawerOpen(false)}>关闭</Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }} ref={captionScrollRef} onScroll={e => { const el = e.target; const { scrollTop, scrollHeight, clientHeight } = el; if (scrollHeight - scrollTop - clientHeight < 100 && !captionHistoryLoading && captionHistory.length < captionHistoryTotal) { const prevHeight = scrollHeight; fetchCaptionHistory(captionKeyword, captionTypeFilter, captionHistoryPage + 1, true).then(() => { requestAnimationFrame(() => { el.scrollTop = scrollTop + (el.scrollHeight - prevHeight); }); }); } }}>
          <Space style={{ marginBottom: 10 }}>
            <Input.Search placeholder="搜索..." value={captionKeyword} onChange={e => setCaptionKeyword(e.target.value)} onSearch={v => fetchCaptionHistory(v, captionTypeFilter)} style={{ width: 120 }} size="small" />
            <Select value={captionTypeFilter} onChange={v => { setCaptionTypeFilter(v); fetchCaptionHistory(captionKeyword, v); }} style={{ width: 80 }} size="small" allowClear placeholder="类型" popupMatchSelectWidth={false} styles={{ popup: { root: { position: 'fixed', zIndex: 1300 } }}}>
              <Select.Option value="douyin">抖音</Select.Option>
              <Select.Option value="xiaohongshu">小红书</Select.Option>
            </Select>
          </Space>
          <Spin spinning={captionHistoryLoading}>
            {captionHistory.length === 0 ? <Empty description="暂无文案" /> : captionHistory.map(cap => (
              <Card key={cap.id} size="small" hoverable style={{ marginBottom: 8 }}
                cover={cap.cover_filename ? <img src={`${API_BASE}/image/thumbnail/${encodeURIComponent(cap.cover_filename)}?size=100`} alt={cap.caption_title} style={{ height: 60, objectFit: 'cover' }} /> : null}
                onClick={() => { const parsedIds = cap.image_ids ? JSON.parse(cap.image_ids) : []; setGeneratedCaption({ ...cap, title: cap.caption_title, setType: cap.set_type, content: cap.caption_body, hashtags: cap.hashtags }); fetch(`${API_BASE}/images/batch?ids=${parsedIds.join(',')}`).then(r => r.json()).then(d => setCaptionModalImages(d.images || [])).catch(() => setCaptionModalImages([])); setCaptionModalVisible(true); setCaptionDrawerOpen(false); }}>
                <Space style={{ marginBottom: 4 }}>
                  <Tag color={cap.set_type === 'douyin' ? 'blue' : 'green'} style={{ fontSize: 10 }}>{cap.set_type === 'douyin' ? '抖音' : '小红书'}</Tag>
                  <Text type="secondary" style={{ fontSize: 10 }}>{cap.date}</Text>
                </Space>
                <Text strong style={{ fontSize: 13 }}>{cap.caption_title || '(无标题)'}</Text>
              </Card>
            ))}
          </Spin>
        </div>
      </div>
    </div>
  );

  // FAB 按钮
  const FABButton = () => {
    if (!isMobile || selectedImages.length === 0) return null;
    return (
      <Dropdown menu={{ items: [
        { key: 'select_all', label: selectedImages.length === displayImages.length ? '取消全选' : '全选', onClick: () => {
          if (selectedImages.length === displayImages.length) {
            setSelectedImages([]);
          } else {
            setSelectedImages([...displayImages]);
          }
        }},
        { key: 'download', label: `下载原图 (${selectedImages.length})`, onClick: handleDownloadOriginal },
        { key: 'theme', label: '生成主题', onClick: handleGenerateTheme },
        { key: 'douyin', label: '抖音文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('douyin'); setCaptionInstructionsModalVisible(true); } },
        { key: 'xiaohongshu', label: '小红书文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('xiaohongshu'); setCaptionInstructionsModalVisible(true); } },
      ] }} trigger={['click']}>
        <Button className="fab-button" type="primary"><ThunderboltOutlined /></Button>
      </Dropdown>
    );
  };

  return (
    <Layout className="app-layout">
      {/* 顶部工具栏 */}
      {isMobile ? (
        <div className="top-toolbar">
          <Button type="text" icon={<MenuOutlined />} onClick={() => { setActiveTab('folder'); setFolderDrawerOpen(true); }} style={{ marginRight: 8, minWidth: 44, height: 44 }} />
          <Title level={4} style={{ margin: 0, flex: 1 }}><CameraOutlined style={{ color: '#10b981', marginRight: 8 }} />摄影素材</Title>
          <Input.Search
            placeholder="搜索..."
            allowClear
            style={{ width: 160 }}
            onSearch={handleSearch}
          />
        </div>
      ) : (
        <div className="top-toolbar">
          <Title level={4} style={{ margin: 0 }}>
            <CameraOutlined /> 摄影素材管理系统
          </Title>
          <Space>
            <Search
              placeholder="搜索文件名、描述、标签..."
              allowClear
              style={{ width: 300 }}
              onSearch={handleSearch}
            />
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 200 }}
            >
              {availableModels.map(m => (
                <Select.Option key={m.id} value={m.id}>
                  {m.name}
                </Select.Option>
              ))}
            </Select>
            <Button icon={<ScanOutlined />} onClick={handleScanAll}>
              扫描
            </Button>
          </Space>
        </div>
      )}

      {/* 移动端抽屉 */}
      {isMobile && <FolderDrawer />}
      {isMobile && <ScoreDrawer />}
      {isMobile && <CaptionDrawer />}
      {isMobile && <FABButton />}

      {/* 底部 Tab 栏 */}
      {isMobile && <BottomTabBar />}

      <Layout>
        {/* 左侧可折叠菜单（桌面端） */}
        <Sider width={260} collapsible collapsed={menuCollapsed} onCollapse={setMenuCollapsed} className={`folder-sider ${isMobile ? 'hide-on-mobile' : ''}`}>
          <Menu
            mode="inline"
            selectedKeys={[activeMenu]}
            onClick={({ key }) => {
              if (key === activeMenu && activeMenu !== 'folder') {
                // 点击已选中的非文件夹菜单,收回面板
                setActiveMenu('folder');
              } else {
                setActiveMenu(key);
                if (key === 'scores') fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter);
                if (key === 'captions') fetchCaptionHistory(captionKeyword, captionTypeFilter);
              }
            }}
            style={{ height: '100%', overflowY: 'auto' }}
          >
            <Menu.SubMenu key="folder" icon={<FolderOutlined />} title="文件夹">
              {!menuCollapsed && (
                <div style={{ padding: '8px 12px' }}>
                  <Tree
                    treeData={treeData}
                    selectedKeys={selectedFolder ? [selectedFolder] : []}
                    onSelect={(keys, info) => {
                      if (info.node.path) {
                        loadImages(info.node.path);
                        setSelectedImages([]);
                        setActiveMenu('folder');
                      }
                    }}
                    showIcon={false}
                  />
                </div>
              )}
            </Menu.SubMenu>

            <Menu.Item key="scores" icon={<StarOutlined />}>
              评分记录
              {failedScores.length > 0 && <Tag color="red" style={{ marginLeft: 8 }}>{failedScores.length}</Tag>}
            </Menu.Item>

            <Menu.Item key="captions" icon={<FileTextOutlined />}>
              文案记录
            </Menu.Item>
          </Menu>
        </Sider>

        {/* 评分记录面板 */}
        {(() => {
          return currentMenuKey === 'scores' && !menuCollapsed && !isMobile;
        })() && (
          <div style={{ width: 300, borderLeft: '1px solid #f0f0f0', padding: 12, overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'none' }}>scores panel: {scoreTasks.length} tasks</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text strong>评分记录</Text>
              <Button type="text" size="small" onClick={() => setActiveMenu('folder')} icon={'>'}>
                收起
              </Button>
            </div>
            <Space style={{ marginBottom: 10 }}>
              <Select value={scoreTaskFilter} onChange={(v) => { setScoreTaskFilter(v); fetchScoreTasks(v === 'all' ? null : v); }} style={{ width: 90 }} size="small">
                <Select.Option value="all">全部</Select.Option>
                <Select.Option value="failed">失败</Select.Option>
                <Select.Option value="processing">处理中</Select.Option>
                <Select.Option value="pending">待处理</Select.Option>
                <Select.Option value="completed">成功</Select.Option>
              </Select>
              <Button size="small" disabled={selectedScoreTaskIds.length === 0} onClick={() => retryScoreTasks(selectedScoreTaskIds)}>
                重试({selectedScoreTaskIds.length})
              </Button>
              <Button size="small" onClick={() => setSelectedScoreTaskIds(scoreTasks.map(t => t.image_id))}>
                全选
              </Button>
              <Text type="secondary" style={{ fontSize: 11 }}>共{scoreTasksTotal}条</Text>
            </Space>
            <Spin spinning={scoreTasksLoading}>
              {scoreTasks.length === 0 && scoreTasksTotal === 0 ? (
                <Empty description="暂无记录" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {scoreTasks.map(task => {
                    const status = String(task.status ?? '');
                    const filename = String(task.filename ?? '');
                    const imageId = Number(task.image_id) || 0;
                    const errorMsg = task.error_message != null ? String(task.error_message) : '';
                    const filePath = task.file_path != null ? String(task.file_path) : '';
                    const isCompleted = status === 'completed';
                    const tagColor = status === 'failed' ? 'red' : status === 'completed' ? 'green' : status === 'processing' ? 'orange' : 'blue';
                    const tagText = status === 'processing' ? '处理中' : status === 'failed' ? '失败' : status === 'completed' ? '成功' : status;
                    return (
                    <Card key={String(task.id)} size="small" hoverable={!isCompleted}
                      style={{ opacity: isCompleted ? 0.6 : 1 }}
                      cover={filePath ? (
                        <img
                          src={`${API_BASE}/image/thumbnail/${encodeURIComponent(filePath)}?size=100`}
                          alt={filename || `ID:${imageId}`}
                          style={{ height: 60, objectFit: 'cover' }}
                        />
                      ) : null}
                      onClick={() => {
                        if (!isCompleted) {
                          setSelectedScoreTaskIds(prev =>
                            prev.includes(imageId)
                              ? prev.filter(id => id !== imageId)
                              : [...prev, imageId]
                          );
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {!isCompleted && (
                          <Checkbox checked={selectedScoreTaskIds.includes(imageId)} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Text ellipsis style={{ fontSize: 12 }}>{filename || `ID:${imageId}`}</Text>
                          <Tag color={tagColor} style={{ fontSize: 10 }}>{tagText}</Tag>
                          {errorMsg && (
                            <Text type="danger" style={{ fontSize: 10 }} ellipsis>{errorMsg}</Text>
                          )}
                        </div>
                        {!isCompleted && (
                          <Button size="small" onClick={(e) => { e.stopPropagation(); retryScoreTasks([imageId]); }}>
                            重试
                          </Button>
                        )}
                      </div>
                    </Card>
                    );
                  })}
                </div>
              )}
            </Spin>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Space>
                <Button size="small" disabled={scoreTasksPage <= 1} onClick={() => fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter, scoreTasksPage - 1)}>上页</Button>
                <Text type="secondary" style={{ fontSize: 11 }}>{scoreTasksPage}</Text>
                <Button size="small" disabled={scoreTasks.length < 20} onClick={() => fetchScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter, scoreTasksPage + 1)}>下页</Button>
              </Space>
            </div>
          </div>
        )}

        {/* 文案记录面板 */}
        {/* 文案记录面板 */}
        {currentMenuKey === 'captions' && !menuCollapsed && !isMobile && (
          <div style={{ width: 320, borderLeft: '1px solid #f0f0f0', padding: 12, overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text strong>文案记录</Text>
              <Button type="text" size="small" onClick={() => setActiveMenu('folder')}>
                收起
              </Button>
            </div>
            <Space style={{ marginBottom: 10 }}>
              <Input.Search
                placeholder="搜索图片ID、文案..."
                value={captionKeyword}
                onChange={e => setCaptionKeyword(e.target.value)}
                onSearch={v => fetchCaptionHistory(v, captionTypeFilter)}
                style={{ width: 160 }}
                size="small"
              />
              <Select value={captionTypeFilter} onChange={v => { setCaptionTypeFilter(v); fetchCaptionHistory(captionKeyword, v); }} style={{ width: 90 }} size="small" allowClear placeholder="类型">
                <Select.Option value="douyin">抖音</Select.Option>
                <Select.Option value="xiaohongshu">小红书</Select.Option>
              </Select>
            </Space>
            <Spin spinning={captionHistoryLoading}>
              {captionHistory.length === 0 ? (
                <Empty description="暂无文案" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {captionHistory.map(cap => (
                    <Card key={cap.id} size="small" hoverable
                      cover={cap.cover_filename ? (
                        <img
                          src={`${API_BASE}/image/thumbnail/${encodeURIComponent(cap.cover_filename)}?size=100`}
                          alt={cap.caption_title}
                          style={{ height: 60, objectFit: 'cover' }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : null}
                      onClick={() => {
                        const parsedIds = cap.image_ids ? JSON.parse(cap.image_ids) : [];
                        setGeneratedCaption({
                          ...cap,
                          title: cap.caption_title,
                          setType: cap.set_type,
                          content: cap.caption_body,
                          hashtags: cap.hashtags
                        });
                        // 从已加载图片中找,没有则去后端查
                        const found = parsedIds.map(id => displayImages.find(img => img.id === id)).filter(Boolean);
                        if (found.length === parsedIds.length) {
                          setCaptionModalImages(found);
                        } else {
                          fetch(`${API_BASE}/images/batch?ids=${parsedIds.join(',')}`)
                            .then(r => r.json())
                            .then(d => setCaptionModalImages(d.images || []))
                            .catch(() => setCaptionModalImages([]));
                        }
                        setCaptionModalVisible(true);
                      }}
                    >
                      <div>
                        <Space style={{ marginBottom: 4 }}>
                          <Tag color={cap.set_type === 'douyin' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
                            {cap.set_type === 'douyin' ? '抖音' : '小红书'}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 10 }}>{cap.date}</Text>
                        </Space>
                        <Text strong style={{ fontSize: 13 }}>{cap.caption_title || '(无标题)'}</Text>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          {cap.image_ids ? `${JSON.parse(cap.image_ids).length}张图片` : ''}
                        </Text>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Spin>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Space>
                <Button size="small" disabled={captionHistoryPage <= 1} onClick={() => fetchCaptionHistory(captionKeyword, captionTypeFilter, captionHistoryPage - 1)}>上页</Button>
                <Text type="secondary" style={{ fontSize: 11 }}>{captionHistoryPage}</Text>
                <Button size="small" disabled={captionHistory.length < 20} onClick={() => fetchCaptionHistory(captionKeyword, captionTypeFilter, captionHistoryPage + 1)}>下页</Button>
                <Text type="secondary" style={{ fontSize: 11 }}>共{captionHistoryTotal}条</Text>
              </Space>
            </div>
          </div>
        )}

        {/* 右侧内容 */}
        <Content className="content-area" ref={contentRef} style={{ overflowAnchor: 'none' }} onScroll={(e) => {
          if (searchResults !== null) return;  // 搜索模式下不触发分页加载
          const { scrollTop, scrollHeight, clientHeight } = e.target;
          // 向下滚到真正接近底部时才加载下一页（阈值增大到600px）
          if (scrollHeight - scrollTop - clientHeight < 600) {
            loadNextPage();
          }
          // 向上滚到很顶部（scrollTop<50px）才加载上一页
          if (scrollTop < 50 && currentPage > 1) {
            loadPrevPage();
          }
        }}>
          {/* 操作栏 */}
          <div className="action-bar">
            <Space>
              <Text>{searchResults ? `搜索结果: ${searchResults.length} 张` : `当前: ${images.length} 张`}{loadingMore && ' (加载更多...)'}</Text>
              {selectedImages.length > 0 && (
                <Tag color="blue">{selectedImages.length} 张已选</Tag>
              )}
              <Button size="small" onClick={() => {
                if (selectedImages.length === displayImages.length) {
                  setSelectedImages([]);
                } else {
                  setSelectedImages([...displayImages]);
                }
              }}>
                {selectedImages.length === displayImages.length ? '取消全选' : '全选'}
              </Button>
            </Space>
            <Space>
              <Select value={sortBy} onChange={(v) => { setSortBy(v); if (selectedFolder) loadImages(selectedFolder, 1); }} style={{ width: 120 }}>
                <Select.Option value="filename">文件名</Select.Option>
                <Select.Option value="total_score">评分</Select.Option>
                <Select.Option value="file_size">大小</Select.Option>
              </Select>
              <Select value={sortOrder} onChange={(v) => { setSortOrder(v); if (selectedFolder) loadImages(selectedFolder, 1); }} style={{ width: 80 }}>
                <Select.Option value="asc">升序</Select.Option>
                <Select.Option value="desc">降序</Select.Option>
              </Select>
              {!isMobile && (
                <>
                  {selectedFolder && (
                    <Button icon={<ThunderboltOutlined />} onClick={handleGenerateTheme}>
                      生成主题
                    </Button>
                  )}
                  <Dropdown menu={{
                    items: [
                      ...(failedCaptions.length > 0 ? [
                        { type: 'divider' },
                        { key: 'failed_header', label: <Text type="danger">失败记录 ({failedCaptions.length})</Text>, disabled: true },
                        ...failedCaptions.map(fc => ({
                          key: fc.key,
                          label: (
                            <Space size="small">
                              <Tag color={fc.setType === 'douyin' ? 'blue' : 'green'} style={{ margin: 0 }}>
                                {fc.setType === 'douyin' ? '抖音' : '小红书'}
                              </Tag>
                              <Text type="secondary" style={{ fontSize: 11 }}>{fc.time}</Text>
                              <Text type="danger" style={{ fontSize: 11 }} ellipsis title={fc.error}>{fc.error}</Text>
                            </Space>
                          ),
                          onClick: () => handleGenerateCaption(fc.setType, fc.imageIds)
                        })),
                        { key: 'retry_all', label: '全部重新生成', onClick: () => {
                          failedCaptions.forEach(fc => handleGenerateCaption(fc.setType, fc.imageIds));
                        }},
                        { type: 'divider' },
                      ] : []),
                      { key: 'douyin', label: '抖音文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('douyin'); setCaptionInstructionsModalVisible(true); } },
                      { key: 'xiaohongshu', label: '小红书文案', onClick: () => { if (!selectedImages?.length) { message.warning('请先选择图片'); return; } captionModalImgRef.current = selectedImages; setPendingCaptionType('xiaohongshu'); setCaptionInstructionsModalVisible(true); } }
                    ]
                  }}>
                    <Button disabled={selectedImages.length === 0}>
                      生成文案 {failedCaptions.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{failedCaptions.length}</Tag>}
                    </Button>
                  </Dropdown>
                  <Dropdown menu={{
                    items: [
                      ...(failedScores.length > 0 ? [
                        { key: 'failed_header', label: <Text type="danger">评分失败 ({failedScores.length})</Text>, disabled: true },
                        ...failedScores.map((fs, idx) => ({
                          key: `fs_${idx}`,
                          label: (
                            <Space size="small">
                              <Text style={{ fontSize: 12 }} ellipsis title={`ID: ${fs.imageId}`}>{displayImages.find(i => i.id === fs.imageId)?.filename || `ID: ${fs.imageId}`}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>{fs.time}</Text>
                              <Text type="danger" style={{ fontSize: 11 }} ellipsis>{fs.error}</Text>
                            </Space>
                          ),
                          onClick: () => handleScore(fs.imageId)
                        })),
                        { key: 'retry_all_scores', label: '全部重新评分', onClick: () => {
                          failedScores.forEach(fs => handleScore(fs.imageId));
                        }},
                        { type: 'divider' },
                      ] : []),
                      { key: 'batch_score', label: selectedImages.length > 0 ? `批量评分 (${selectedImages.length}张)` : '批量评分', onClick: () => handleBatchScore(), disabled: selectedImages.length === 0 }
                    ]
                  }}>
                    <Button type="primary" icon={<ThunderboltOutlined />} disabled={selectedImages.length === 0}>
                      批量评分 {failedScores.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{failedScores.length}</Tag>}
                    </Button>
                  </Dropdown>
                </>
              )}
            </Space>
          </div>

          {/* 图片网格 */}
          <Spin spinning={loading}>
            {displayImages.length > 0 ? (
              <Row gutter={[16, 16]} className="image-grid">
                {displayImages.map(img => (
                  <Col key={img.id} xs={12} sm={8} md={6} lg={4}>
                    <Card
                      hoverable
                      className={`image-card ${selectedImages.some(item => (item.id || item) === img.id) ? 'selected' : ''}`}
                      cover={
                        <div className="image-cover" onClick={() => {
                          // 切换选中状态（与checkbox一致）
                          setSelectedImages(prev =>
                            prev.some(item => (item.id || item) === img.id)
                              ? prev.filter(item => (item.id || item) !== img.id)
                              : [...prev, img]
                          );
                          const imageUrl = `${API_BASE}/image/proxy/${encodeURIComponent(img.file_path)}`;
                          setSelectedImage({ ...img, imageUrl });
                          setPreviewVisible(true);
                        }}>
                          <img
                            src={`${API_BASE}/image/thumbnail/${encodeURIComponent(img.file_path)}?size=400`}
                            alt={img.filename}
                          />
                          <Tooltip title={`评分: ${img.total_score ? img.total_score.toFixed(1) : scoringRef.current.has(img.id) ? '评分中...' : '待评分'}${img.score_count ? ` (${img.score_count}次)` : ''}`}>
                            <div className="image-score"
                              style={{ backgroundColor: getScoreColor(img.total_score) }}
                            >
                              {img.total_score ? `⭐ ${img.total_score.toFixed(1)}` : scoringRef.current.has(img.id) ? '评分中' : '待评分'}
                            </div>
                          </Tooltip>
                          <div className="image-check"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImages(prev =>
                                prev.some(item => (item.id || item) === img.id)
                                  ? prev.filter(item => (item.id || item) !== img.id)
                                  : [...prev, img]
                              );
                            }}
                          >
                            {selectedImages.some(item => (item.id || item) === img.id) ? <CheckOutlined /> : null}
                          </div>
                        </div>
                      }
                      actions={[
                        <Tooltip title="评分" key="score">
                          <MessageOutlined onClick={() => handleScore(img.id)} />
                        </Tooltip>,
                        <Tooltip title="下载原图" key="download">
                          <DownloadOutlined onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const a = document.createElement('a');
                            a.href = `${API_BASE}/image/proxy/${encodeURIComponent(img.file_path)}`;
                            a.download = img.filename || `image_${img.id}`;
                            a.target = '_blank';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          }} />
                        </Tooltip>,
                      ]}
                    >
                      <Card.Meta
                        title={<Text ellipsis>{img.filename}</Text>}
                        description={
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {img.width}x{img.height} | {(img.file_size / 1024 / 1024).toFixed(1)}MB
                            </Text>
                            {img.tags && (
                              <div style={{ marginTop: 4 }}>
                                {img.tags.split(',').slice(0, 3).map((tag, i) => (
                                  <Tag key={i} size="small">{tag.trim()}</Tag>
                                ))}
                              </div>
                            )}
                          </div>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty description={searchResults !== null ? '未找到匹配的图片' : '选择一个文件夹开始'} />
            )}
          </Spin>
        </Content>
      </Layout>

      {/* 图片预览 */}
      <Modal
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={1000}
        centered
      >
        {selectedImage && (
          <div className="image-preview" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <Image
                src={selectedImage.imageUrl}
                alt={selectedImage.filename}
                style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain' }}
                preview={{ src: selectedImage.imageUrl }}
              />
            </div>
            <Divider />

            {/* 基本信息和评分 */}
            <Row gutter={16}>
              <Col span={8}>
                <Title level={5}>基本信息</Title>
                <p>ID: {selectedImage.id}</p>
                <p>文件名: {selectedImage.filename}</p>
                <p>尺寸: {selectedImage.width}x{selectedImage.height}</p>
                <p>方向: {selectedImage.orientation}</p>
              </Col>
              <Col span={16}>
                <Title level={5}>综合评分: {selectedImage.total_score ? `⭐ ${selectedImage.total_score.toFixed(1)}` : '待评分'}</Title>
                <Button type="primary" onClick={() => {
                  handleScore(selectedImage.id);
                  setPreviewVisible(false);
                }}>
                  {selectedImage.total_score ? '重新评分' : '发起评分'}
                </Button>
              </Col>
            </Row>

            {/* 详细评分分析 */}
            {selectedImage.impact_analysis && (
              <>
                <Divider />
                <Title level={5}>📊 详细评分分析</Title>
                <Row gutter={[16, 16]}>
                  {[
                    { key: 'impact', label: '冲击力', weight: '25%' },
                    { key: 'composition', label: '构图', weight: '25%' },
                    { key: 'sharpness', label: '清晰度', weight: '20%' },
                    { key: 'exposure', label: '曝光', weight: '15%' },
                    { key: 'color', label: '色彩', weight: '10%' },
                    { key: 'uniqueness', label: '独特性', weight: '5%' },
                  ].map(dim => (
                    <Col span={12} key={dim.key}>
                      <Card size="small" title={`${dim.label} (${dim.weight})`}>
                        <p><Tag color={selectedImage[`${dim.key}_score`] >= 80 ? 'green' : selectedImage[`${dim.key}_score`] >= 60 ? 'blue' : 'orange'}>
                          分数: {selectedImage[`${dim.key}_score`]?.toFixed(1) || '-'}
                        </Tag></p>
                        <p style={{ fontSize: 12, color: '#666' }}>分析: {selectedImage[`${dim.key}_analysis`] || '-'}</p>
                        {selectedImage[`${dim.key}_suggestion`] && (
                          <p style={{ fontSize: 12, color: '#1890ff' }}>💡 建议: {selectedImage[`${dim.key}_suggestion`]}</p>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              </>
            )}

            {/* 图片描述 */}
            {selectedImage.description && (
              <>
                <Divider />
                <Title level={5}>📝 画面描述</Title>
                <p>{selectedImage.description}</p>
              </>
            )}

            {/* 标签 */}
            {selectedImage.tags && (
              <div>
                <Tag color="blue">{selectedImage.tags}</Tag>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 主题弹窗 */}
      <Modal
        open={themeModalVisible}
        onCancel={() => setThemeModalVisible(false)}
        footer={null}
        width={600}
        title="每日主题"
      >
        {dailyTheme && (
          <div className="theme-content">
            <Title level={3}>{dailyTheme.theme?.theme_title}</Title>
            <p>{dailyTheme.theme?.theme_description}</p>
            <Divider />
            <Space>
              <Tag color="blue">照片数: {dailyTheme.photo_count}</Tag>
              <Tag color="green">平均分: {dailyTheme.avg_score}</Tag>
            </Space>
            <Divider />
            <Text strong>关键词: </Text>
            <span>{dailyTheme.theme?.keywords}</span>
          </div>
        )}
      </Modal>

      {/* 文案弹窗 */}
      <CaptionInstructionsModal
        open={captionInstructionsModalVisible}
        captionType={pendingCaptionType}
        imageIds={captionModalImgRef.current}
        onCancel={() => setCaptionInstructionsModalVisible(false)}
        onGenerate={(inst) => {
          const imgs = captionModalImgRef.current;
          if (!imgs?.length) { message.warning('请先选择图片'); return; }
          const ids = imgs.map(img => img.id);
          setCaptionInstructionsModalVisible(false);
          handleGenerateCaption(pendingCaptionType, ids, inst);
        }}
      />

      <Modal
        open={captionModalVisible}
        onCancel={() => { setCaptionModalVisible(false); setCaptionModalImages([]); }}
        footer={null}
        width={660}
        title={generatedCaption?.setType === 'douyin' ? '抖音文案' : '小红书文案'}
      >
        {generatedCaption && (
          <div className="caption-content">
            {/* 朋友圈风格图片网格 */}
            {captionModalImages.length > 0 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 16 }}>
                  {captionModalImages.map((img, idx) => (
                    <div
                      key={img.id}
                      style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', background: '#f0f0f0', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedImage({
                          ...img,
                          imageUrl: `${API_BASE}/image/proxy/${encodeURIComponent(img.file_path)}`
                        });
                        setPreviewVisible(true);
                      }}
                    >
                      <img
                        src={`${API_BASE}/image/thumbnail/${encodeURIComponent(img.file_path)}?size=300`}
                        alt={img.filename}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.opacity = 0; }}
                      />
                    </div>
                  ))}
                </div>
                <Divider style={{ margin: '12px 0' }} />
              </>
            )}
            <Title level={4}>{generatedCaption.title || '(无标题)'}</Title>
            <Divider />
            <p style={{ whiteSpace: 'pre-wrap' }}>
              {generatedCaption.content || generatedCaption.description || generatedCaption.text || generatedCaption.caption || '(无内容)'}
            </p>
            <Divider />
            <div>
              {(generatedCaption.hashtags || '').split(/[\s,]+/).filter(Boolean).map((tag, i) => (
                <Tag key={i} color="blue">{tag}</Tag>
              ))}
            </div>
            <Divider />
            <Button
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(
                `${generatedCaption.title || ''}\n\n${generatedCaption.content || generatedCaption.description || generatedCaption.text || generatedCaption.caption || ''}\n\n${generatedCaption.hashtags || ''}`
              )}
            >
              复制文案
            </Button>
          </div>
        )}
      </Modal>
    </Layout>
  );
}

export default App;
