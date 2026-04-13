import { useState, useRef, useCallback } from 'react';
import { message } from 'antd';
import { searchImages } from '../api/imageApi';

/**
 * 搜索 hook
 * 封装：防抖搜索、结果分页加载
 */
export function useSearch({ onSearchStart } = {}) {
  const [searchResults, setSearchResults] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const searchTimerRef = useRef(null);

  // 执行搜索
  const executeSearch = useCallback(async (value) => {
    if (!value.trim()) {
      setSearchResults(null);
      setSearchPage(1);
      setSearchTotal(0);
      setSearchKeyword('');
      return;
    }

    setLoading(true);
    try {
      const data = await searchImages(value, { page: 1, pageSize: 50 });
      setSearchResults(data.images || []);
      setSearchPage(data.page || 1);
      setSearchTotal(data.total || 0);
      setSearchKeyword(value);
    } catch (err) {
      message.error('搜索失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 防抖搜索入口
  const handleSearch = useCallback((value) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (onSearchStart) onSearchStart();
    searchTimerRef.current = setTimeout(() => executeSearch(value), 500);
  }, [executeSearch, onSearchStart]);

  // 加载更多搜索结果
  const loadMoreSearchResults = useCallback(async () => {
    if (loading || !searchKeyword) return;
    const nextPage = searchPage + 1;
    if ((searchPage * 50) >= searchTotal) return;
    setLoading(true);
    try {
      const data = await searchImages(searchKeyword, { page: nextPage, pageSize: 50 });
      setSearchResults(prev => [...(prev || []), ...(data.images || [])]);
      setSearchPage(nextPage);
    } catch (err) {
      message.error('加载更多失败');
    } finally {
      setLoading(false);
    }
  }, [loading, searchKeyword, searchPage, searchTotal]);

  // 清除搜索
  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchPage(1);
    setSearchTotal(0);
    setSearchKeyword('');
  }, []);

  return {
    searchResults,
    searchPage,
    searchTotal,
    searchKeyword,
    loading,
    handleSearch,
    loadMoreSearchResults,
    clearSearch
  };
}
