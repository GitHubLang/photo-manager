import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { fetchFolders, fetchImages, fetchAppState, saveAppState, scanAllFolders } from '../api/imageApi';

/**
 * 图片管理 hook
 * 封装：文件夹列表、图片加载、分页、排序、浏览位置恢复
 */
export function useImages() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('filename');
  const [sortOrder, setSortOrder] = useState('asc');

  // 内部 refs
  const loadedPagesSet = useRef(new Set());
  const loadingPagesSet = useRef(new Set());
  const isRestoringRef = useRef(false);
  const scrollBusyRef = useRef(false);
  const contentRef = useRef(null);

  // 持久化状态到 localStorage
  const persistState = useCallback((state) => {
    try {
      localStorage.setItem('photoManagerAppState', JSON.stringify(state));
    } catch (e) {
      console.warn('localStorage persist failed', e);
    }
  }, []);

  // 从 localStorage 读取状态
  const loadPersistedState = useCallback(() => {
    try {
      const saved = localStorage.getItem('photoManagerAppState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('localStorage load failed', e);
    }
    return null;
  }, []);

  // 保存应用状态到服务器
  const persistToServer = useCallback((state) => {
    saveAppState(state).catch(err => console.warn('saveAppState failed', err));
  }, []);

  // 统一保存状态（同时写 localStorage 和服务器）
  const saveState = useCallback((state) => {
    persistState(state);
    persistToServer(state);
  }, [persistState, persistToServer]);

  // 加载目录树
  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchFolders();
      const folderList = data.folders || [];
      setFolders(folderList);
      return folderList;
    } catch (err) {
      message.error('加载目录失败');
      return [];
    }
  }, []);

  // 加载图片
  const loadImages = useCallback(async (folderPath, page = 1, append = false) => {
    if (!folderPath) return;

    if (page === 1 && !append) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const data = await fetchImages(folderPath, {
        page,
        pageSize: 50,
        sortBy,
        sortOrder
      });

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

      // 保存状态（除非正在恢复浏览位置）
      if (!isRestoringRef.current) {
        saveState({
          last_folder_path: folderPath,
          last_page: page,
          last_sort_by: sortBy,
          last_sort_order: sortOrder,
          last_scroll_top: contentRef.current ? contentRef.current.scrollTop : 0
        });
      }
    } catch (err) {
      message.error('加载图片失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      scrollBusyRef.current = false;
      if (isRestoringRef.current) {
        isRestoringRef.current = false;
        saveState({
          last_folder_path: folderPath,
          last_page: page,
          last_sort_by: sortBy,
          last_sort_order: sortOrder,
          last_scroll_top: contentRef.current ? contentRef.current.scrollTop : 0
        });
      }
    }
  }, [sortBy, sortOrder, saveState]);

  // 加载上一页（向上翻页，保持当前位置）
  const loadPrevPage = useCallback(async () => {
    if (isRestoringRef.current || scrollBusyRef.current) return;
    if (loadedPagesSet.current.has(1)) return;
    if (!selectedFolder) return;

    let prevPage = currentPage - 1;
    while ((loadedPagesSet.current.has(prevPage) || loadingPagesSet.current.has(prevPage)) && prevPage > 1) {
      prevPage--;
    }
    if (prevPage < 1) return;

    scrollBusyRef.current = true;
    loadingPagesSet.current.add(prevPage);
    setLoadingMore(true);

    try {
      const data = await fetchImages(selectedFolder, {
        page: prevPage,
        pageSize: 50,
        sortBy,
        sortOrder
      });

      if (data.images && data.images.length > 0) {
        const contentEl = contentRef.current;
        const scrollTopBefore = contentEl ? contentEl.scrollTop : 0;
        const clientHeight = contentEl ? contentEl.clientHeight : 0;
        const scrollHeightBefore = contentEl ? contentEl.scrollHeight : 0;
        const bottomBoundary = scrollHeightBefore - scrollTopBefore - clientHeight;

        setImages(prev => [...data.images, ...prev]);
        setCurrentPage(prevPage);
        loadedPagesSet.current.add(prevPage);
        loadingPagesSet.current.delete(prevPage);

        saveState({
          last_folder_path: selectedFolder,
          last_page: prevPage,
          last_sort_by: sortBy,
          last_sort_order: sortOrder,
          last_scroll_top: 0
        });

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
      loadingPagesSet.current.delete(prevPage);
    } finally {
      setLoadingMore(false);
      scrollBusyRef.current = false;
    }
  }, [currentPage, selectedFolder, sortBy, sortOrder, saveState]);

  // 加载下一页（向下翻页）
  const loadNextPage = useCallback(() => {
    if (isRestoringRef.current || scrollBusyRef.current) return;
    if (loadedPagesSet.current.has(totalPages)) return;
    if (!selectedFolder) return;

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
  }, [currentPage, totalPages, selectedFolder, loadImages]);

  // 扫描所有文件夹
  const handleScanAll = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scanAllFolders();
      message.success('扫描完成:新增 ' + data.added + ' 张,跳过 ' + data.skipped + ' 张');
      if (selectedFolder) {
        loadImages(selectedFolder, 1);
      }
      loadFolders();
    } catch (err) {
      message.error('扫描失败');
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, loadImages, loadFolders]);

  // 排序变化
  const handleSortChange = useCallback((by, order) => {
    setSortBy(by);
    setSortOrder(order);
    if (selectedFolder) {
      loadImages(selectedFolder, 1);
    }
  }, [selectedFolder, loadImages]);

  // 恢复浏览位置
  const restoreBrowseState = useCallback(async (currentFolders) => {
    if (!currentFolders || currentFolders.length === 0) return;

    let state = loadPersistedState();

    // 如果 localStorage 没有，尝试从服务器获取
    if (!state) {
      try {
        const serverState = await fetchAppState();
        if (serverState.last_folder_path) {
          state = serverState;
        }
      } catch (err) {
        console.warn('fetchAppState failed', err);
      }
    }

    if (state && state.last_folder_path) {
      const folderName = state.last_folder_path.split(/[/\\]/).pop();
      const matched = currentFolders.find(f => f.path.split(/[/\\]/).pop() === folderName);

      if (matched) {
        isRestoringRef.current = true;
        setSortBy(state.last_sort_by || 'filename');
        setSortOrder(state.last_sort_order || 'asc');

        // 先加载图片
        await loadImages(matched.path, state.last_page || 1);

        // 恢复滚动位置
        if (contentRef.current && state.last_scroll_top > 0) {
          requestAnimationFrame(() => {
            if (contentRef.current) {
              contentRef.current.scrollTop = state.last_scroll_top;
            }
          });
        }
      }
    }
  }, [loadImages, loadPersistedState]);

  // 初始化：加载文件夹列表，然后恢复浏览状态
  useEffect(() => {
    loadFolders().then(restoreBrowseState);
  }, []);

  return {
    // 状态
    folders,
    selectedFolder,
    images,
    loading,
    loadingMore,
    currentPage,
    sortBy,
    sortOrder,
    contentRef,

    // 操作方法
    loadImages,
    loadNextPage,
    loadPrevPage,
    handleSortChange,
    handleScanAll,
  };
}
