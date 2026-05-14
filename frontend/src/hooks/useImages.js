import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { fetchFolders, fetchImages, fetchAppState, saveAppState, scanAllFolders, fetchScanProgress } from '../api/imageApi';

/**
 * 图片管理 hook — 简化版
 * 导航：无限滚动 + 页码
 * 恢复：只记 last_page + last_folder_path
 */
export function useImages() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const loadedPagesSet = useRef(new Set());
  const loadingPagesSet = useRef(new Set());
  const isRestoringRef = useRef(false);
  const scrollBusyRef = useRef(false);
  const contentRef = useRef(null);

  // ========== 状态持久化（只记文件夹 + 页码）==========

  const persistState = useCallback((folderPath, page) => {
    const state = { last_folder_path: folderPath, last_page: page, last_sort_by: sortBy, last_sort_order: sortOrder };
    try { localStorage.setItem('photoManagerAppState', JSON.stringify(state)); } catch {}
    saveAppState(state).catch(() => {});
  }, [sortBy, sortOrder]);

  const loadPersistedState = useCallback(() => {
    try {
      const saved = localStorage.getItem('photoManagerAppState');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  }, []);

  // ========== 数据加载 ==========

  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchFolders();
      setFolders(data.folders || []);
      return data.folders || [];
    } catch { message.error('加载目录失败'); return []; }
  }, []);

  /** 加载图片：_sortBy/_sortOrder 可选，避免闭包陷阱 */
  const loadImages = useCallback(async (folderPath, page = 1, append = false, _sortBy, _sortOrder) => {
    const sBy = _sortBy ?? sortBy;
    const sOrd = _sortOrder ?? sortOrder;
    if (!folderPath) return;

    if (page === 1 && !append) setLoading(true);
    else setLoadingMore(true);

    try {
      const data = await fetchImages(folderPath, { page, pageSize: 50, sortBy: sBy, sortOrder: sOrd });

      if (append) {
        setImages(prev => [...prev, ...(data.images || [])]);
        loadedPagesSet.current.add(data.page);
        loadingPagesSet.current.delete(data.page);
      } else {
        setImages(data.images || []);
        loadedPagesSet.current = new Set([data.page]);
        loadingPagesSet.current.clear();
      }

      setCurrentPage(data.page);
      setTotalPages(data.total_pages);
      setSelectedFolder(folderPath);

      // 只在首次加载文件夹时保存
      if (!isRestoringRef.current && !append) {
        persistState(folderPath, page);
      }
    } catch { message.error('加载图片失败'); }
    finally {
      setLoading(false);
      setLoadingMore(false);
      scrollBusyRef.current = false;
      if (isRestoringRef.current) {
        isRestoringRef.current = false;
        persistState(folderPath, page);
      }
    }
  }, [sortBy, sortOrder, persistState]);

  // ========== 翻页 ==========

  /** 跳转到指定页 */
  const goToPage = useCallback((page) => {
    if (!selectedFolder) return;
    loadedPagesSet.current.clear();
    loadingPagesSet.current.clear();
    loadImages(selectedFolder, page, false, sortBy, sortOrder);
    // 跳页后滚到顶部
    requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.scrollTop = 0;
    });
  }, [selectedFolder, sortBy, sortOrder, loadImages]);

  /** 向上翻页（无限滚动） */
  const loadPrevPage = useCallback(async () => {
    if (isRestoringRef.current || scrollBusyRef.current) return;
    if (loadedPagesSet.current.has(1)) return;
    if (!selectedFolder) return;

    let prevPage = currentPage - 1;
    while ((loadedPagesSet.current.has(prevPage) || loadingPagesSet.current.has(prevPage)) && prevPage > 1) prevPage--;
    if (prevPage < 1) return;

    scrollBusyRef.current = true;
    loadingPagesSet.current.add(prevPage);
    setLoadingMore(true);

    try {
      const data = await fetchImages(selectedFolder, { page: prevPage, pageSize: 50, sortBy, sortOrder });
      if (data.images?.length > 0) {
        setImages(prev => [...data.images, ...prev]);
        setCurrentPage(prevPage);
        loadedPagesSet.current.add(prevPage);
        loadingPagesSet.current.delete(prevPage);
        persistState(selectedFolder, prevPage);
      }
    } catch { loadingPagesSet.current.delete(prevPage); }
    finally { setLoadingMore(false); scrollBusyRef.current = false; }
  }, [currentPage, selectedFolder, sortBy, sortOrder, persistState]);

  /** 向下翻页（无限滚动） */
  const loadNextPage = useCallback(() => {
    if (isRestoringRef.current || scrollBusyRef.current) return;
    if (loadedPagesSet.current.has(totalPages)) return;
    if (!selectedFolder) return;

    let nextPage = currentPage + 1;
    while ((loadedPagesSet.current.has(nextPage) || loadingPagesSet.current.has(nextPage)) && nextPage <= totalPages) nextPage++;
    if (nextPage > totalPages) return;

    scrollBusyRef.current = true;
    loadingPagesSet.current.add(nextPage);
    requestAnimationFrame(async () => {
      await loadImages(selectedFolder, nextPage, true);
      persistState(selectedFolder, nextPage);
    });
  }, [currentPage, totalPages, selectedFolder, loadImages]);

  // ========== 排序 ==========

  const handleSortChange = useCallback((by, order) => {
    setSortBy(by);
    setSortOrder(order);
    if (selectedFolder) loadImages(selectedFolder, 1, false, by, order);
  }, [selectedFolder, loadImages]);

  // ========== 评分完成后原地更新 ==========

  const updateImage = useCallback((imageId, updatedFields) => {
    setImages(prev => prev.map(img => img.id === imageId ? { ...img, ...updatedFields } : img));
  }, []);

  /** 递归展开文件夹列表（将嵌套树拍平成数组） */
  const flattenFolders = useCallback((folderList) => {
    const result = [];
    const walk = (nodes) => {
      for (const node of nodes) {
        result.push(node);
        if (node.children && node.children.length > 0) {
          walk(node.children);
        }
      }
    };
    walk(folderList);
    return result;
  }, []);

  // ========== 扫描 ==========

  const handleScanAll = useCallback(async () => {
    setLoading(true);
    const hideMsg = message.loading('正在启动扫描...', 0);
    try {
      const data = await scanAllFolders();
      const { task_id } = data;
      if (!task_id) throw new Error('No task_id');
      let lastUpdate = 0;
      const result = await new Promise((resolve, reject) => {
        const timer = setInterval(async () => {
          try {
            const p = await fetchScanProgress(task_id);
            if (p.status === 'not_found') { clearInterval(timer); reject(new Error('Task lost')); return; }
            if (Date.now() - lastUpdate > 1500 && p.progress) {
              lastUpdate = Date.now();
              hideMsg();
              message.loading('正在扫描: ' + (p.progress.current_folder || '...') + ' (' + p.progress.current + '/' + p.progress.total + ') - 新增' + p.progress.added + ', 跳过' + p.progress.skipped, 2);
            }
            if (p.status === 'completed') { clearInterval(timer); resolve(p.result || {}); }
          } catch {}
        }, 2000);
      });
      hideMsg();
      message.success('扫描完成: 新增 ' + (result.added || 0) + ' 张, 跳过 ' + (result.skipped || 0) + ' 张', 4);
      if (selectedFolder) loadImages(selectedFolder, 1);
      loadFolders();
    } catch (err) {
      hideMsg();
      message.error('扫描失败: ' + (err.message || '未知错误'));
    } finally { setLoading(false); }
  }, [selectedFolder, loadImages, loadFolders]);

  // ========== 恢复浏览位置（仅恢复文件夹 + 页码）==========

  const restoreBrowseState = useCallback(async (currentFolders) => {
    if (!currentFolders?.length) return;
    // 拍平目录树，搜索匹配路径
    const flatFolders = flattenFolders(currentFolders);
    let state = loadPersistedState();
    if (!state) {
      try {
        const s = await fetchAppState();
        if (s.last_folder_path) state = s;
      } catch {}
    }
    if (state?.last_folder_path) {
      // 先尝试精确匹配路径
      let matched = flatFolders.find(f => f.path === state.last_folder_path);
      // 如果没找到，尝试按文件夹名匹配
      if (!matched) {
        const folderName = state.last_folder_path.split(/[/\\]/).pop();
        matched = flatFolders.find(f => f.path.split(/[/\\]/).pop() === folderName);
      }
      if (matched) {
        isRestoringRef.current = true;
        setSortBy(state.last_sort_by || 'created_at');
        setSortOrder(state.last_sort_order || 'desc');
        await loadImages(matched.path, state.last_page || 1);
      }
    }
  }, [loadImages, loadPersistedState, flattenFolders]);

  useEffect(() => { loadFolders().then(restoreBrowseState); }, []);

  return {
    folders, selectedFolder, images, loading, loadingMore,
    currentPage, totalPages, sortBy, sortOrder, contentRef,
    loadImages, loadNextPage, loadPrevPage, goToPage,
    handleSortChange, handleScanAll, updateImage,
  };
}
