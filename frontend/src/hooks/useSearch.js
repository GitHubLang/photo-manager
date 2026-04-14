import { useState, useRef, useCallback } from 'react';
import { message } from 'antd';
import { searchImages } from '../api/imageApi';

/**
 * Search hook
 * Handles: debounced search, results pagination, loading states
 * 
 * @param {Object} options
 * @param {Function} options.onSearchStart - callback fired when search begins
 */
export function useSearch({ onSearchStart } = {}) {
  const [searchResults, setSearchResults] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const searchTimerRef = useRef(null);

  /**
   * Execute search with given keyword
   * @param {string} value - search keyword
   */
  const executeSearch = useCallback(async (value) => {
    if (!value?.trim()) {
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
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Debounced search handler (500ms)
   * @param {string} value - search keyword
   */
  const handleSearch = useCallback((value) => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (onSearchStart) {
      onSearchStart();
    }
    searchTimerRef.current = setTimeout(() => {
      executeSearch(value);
    }, 500);
  }, [executeSearch, onSearchStart]);

  /**
   * Load more search results (pagination)
   */
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

  /**
   * Clear search state
   */
  const clearSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
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
    executeSearch,
    handleSearch,
    loadMoreSearchResults,
    clearSearch
  };
}
