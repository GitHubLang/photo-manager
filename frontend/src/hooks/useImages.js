import { useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import { fetchFolders, fetchImages, fetchAppState, saveAppState, scanAllFolders, fetchScanProgress } from '../api/imageApi';

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
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // 内部 refs
  const loadedPagesSet = useRef(new Set());
  const loadingPagesSet = useRef(new Set());
  const isRestoringRef = useRef(false);
  const scrollBusyRef = useRef(false);
  const contentRef = useRef(null);
  const saveTimerRef = useRef(null);

  // 获取当前视口第一个可见图片的 ID
  const getAnchorImageId = useCallback(() => {
    if (!contentRef.current) return 0;
    const cards = contentRef.current.querySelectorAll('.ant-col[data-img-id]');
    const containerRect = contentRef.current.getBoundingClientRect();
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.bottom > containerRect.top + 10) {
        return Number(card.getAttribute('data-img-id')) || 0;
      }
    }
    return 0;
  }, []);

  // 滚动停止 800ms 后自动保存位置
  const scheduleSave = useCallback(() => {
    if (isRestoringRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      if (!selectedFolder || !contentRef.current) return;
      saveState({
        last_folder_path: selectedFolder,
        last_page: currentPage,
        last_sort_by: sortBy,
        last_sort_order: sortOrder,
        last_scroll_top: contentRef.current.scrollTop,
        anchor_image_id: getAnchorImageId()
      });
    }, 800);
  }, [selectedFolder, currentPage, sortBy, sortOrder, saveState, getAnchorImageId]);

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

  // 加载图片（可传入 sort 覆写，避免 useState 闭包陷阱）
  const loadImages = useCallback(async (folderPath, page = 1, append = false, _sortBy, _sortOrder) => {
    const effectiveSortBy = _sortBy ?? sortBy;
    const effectiveSortOrder = _sortOrder ?? sortOrder;
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
        sortBy: effectiveSortBy,
        sortOrder: effectiveSortOrder
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
          last_scroll_top: contentRef.current ? contentRef.current.scrollTop : 0,
          anchor_image_id: getAnchorImageId()
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
          last_scroll_top: contentRef.current ? contentRef.current.scrollTop : 0,
          anchor_image_id: getAnchorImageId()
        });
      }
    }
  }, [sortBy, sortOrder, saveState]);

  // 加载上一页（向上翻页，靠 DOM 锚点保持位置）
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

    // 记录当前第一个可见卡片作为锚点
    const contentEl = contentRef.current;
    let anchorEl = null;
    let anchorOffsetY = 0;
    if (contentEl) {
      const cards = contentEl.querySelectorAll('.ant-col');
      const cRect = contentEl.getBoundingClientRect();
      for (const card of cards) {
        const r = card.getBoundingClientRect();
        if (r.bottom > cRect.top + 1) {
          anchorEl = card;
          anchorOffsetY = r.top - cRect.top;
          break;
        }
      }
    }

    try {
      const data = await fetchImages(selectedFolder, {
        page: prevPage,
        pageSize: 50,
        sortBy,
        sortOrder
      });

      if (data.images && data.images.length > 0) {
        setImages(prev => [...data.images, ...prev]);
        setCurrentPage(prevPage);
        loadedPagesSet.current.add(prevPage);
        loadingPagesSet.current.delete(prevPage);

        // 恢复滚动：把锚点卡片拉到刚才的位置
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (anchorEl && anchorEl.isConnected && contentEl) {
              const newTop = anchorEl.getBoundingClientRect().top;
              const cTop = contentEl.getBoundingClientRect().top;
              contentEl.scrollTop += (newTop - cTop) - anchorOffsetY;
            }
          });
        });
      }
    } catch (err) {
      console.error('加载上一页失败', err);
      loadingPagesSet.current.delete(prevPage);
    } finally {
      setLoadingMore(false);
      scrollBusyRef.current = false;
    }
  }, [currentPage, selectedFolder, sortBy, sortOrder, saveState, getAnchorImageId, scheduleSave]);


  // 更新单张图片数据（评分完成后原地更新，不用重刷列表）
  const updateImage = useCallback((imageId, updatedFields) => {
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, ...updatedFields } : img
    ));
  }, []);

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

  // 扫描所有文件夹（异步后台 + 轮询进度）
  const handleScanAll = useCallback(async () => {
    setLoading(true);
    const hideMsg = message.loading('正在启动扫描...', 0);
    try {
      const { task_id, total_folders } = await scanAllFolders();
      if (!task_id) throw new Error('No task_id');

      // 轮询进度
      let lastUpdate = 0;
      const poll = () => new Promise((resolve, reject) => {
        const timer = setInterval(async () => {
          try {
            const progress = await fetchScanProgress(task_id);
            if (progress.status === 'not_found') {
              clearInterval(timer);
              reject(new Error('Task lost'));
              return;
            }
            const now = Date.now();
            if (now - lastUpdate > 1500 && progress.progress) {
              lastUpdate = now;
              const p = progress.progress;
              hideMsg();
              message.loading(
                `正在扫描: ${p.current_folder || '...'} (${p.current}/${p.total}) - 新增${p.added}, 跳过${p.skipped}`,
                2
              );
            }
            if (progress.status === 'completed') {
              clearInterval(timer);
              const r = progress.result || {};
              resolve(r);
            }
          } catch (e) {
            // 继续轮询
          }
        }, 2000);
      });

      const result = await poll();
      hideMsg();
      message.success('扫描完成: 新增 ' + (result.added || 0) + ' 张, 跳过 ' + (result.skipped || 0) + ' 张', 4);
      if (selectedFolder) {
        loadImages(selectedFolder, 1);
      }
      loadFolders();
    } catch (err) {
      hideMsg();
      message.error('扫描失败: ' + (err.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  }, [selectedFolder, loadImages, loadFolders]);

  // 排序变化（直接传新值给 loadImages，跳过闭包陷阱）
  const handleSortChange = useCallback((by, order) => {
    setSortBy(by);
    setSortOrder(order);
    if (selectedFolder) {
      loadImages(selectedFolder, 1, false, by, order);
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
        setSortBy(state.last_sort_by || 'created_at');
        setSortOrder(state.last_sort_order || 'desc');

        // 加载保存的页面
        await loadImages(matched.path, state.last_page || 1);

        // 如果有保存的锚点图片ID，滚动到该图片
        const anchorId = state.anchor_image_id;
        if (anchorId && contentRef.current) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const el = contentRef.current;
              if (!el) return;
              const card = el.querySelector('.ant-col[data-img-id="' + anchorId + '"]');
              if (card) {
                card.scrollIntoView({ block: 'start', behavior: 'instant' });
              } else if (state.last_scroll_top > 0) {
                el.scrollTop = Math.min(state.last_scroll_top, el.scrollHeight - el.clientHeight);
              }
            });
          });
        } else if (state.last_scroll_top > 0 && contentRef.current) {
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
    scheduleSave,
    updateImage,
  };
}
