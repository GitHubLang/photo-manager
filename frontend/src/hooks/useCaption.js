import { useState, useCallback } from 'react';
import { message } from 'antd';
import { fetchCaptionHistory as apiFetchCaptionHistory } from '../api/imageApi';

/**
 * 文案记录 hook
 * 封装：文案历史获取、搜索、分页
 */
export function useCaption() {
  const [captionHistory, setCaptionHistory] = useState([]);
  const [captionHistoryTotal, setCaptionHistoryTotal] = useState(0);
  const [captionHistoryPage, setCaptionHistoryPage] = useState(1);
  const [captionHistoryLoading, setCaptionHistoryLoading] = useState(false);
  const [captionKeyword, setCaptionKeyword] = useState('');
  const [captionTypeFilter, setCaptionTypeFilter] = useState(null);
  const [failedCaptions, setFailedCaptions] = useState([]);
  const [generatedCaption, setGeneratedCaption] = useState(null);
  const [captionModalImages, setCaptionModalImages] = useState([]);

  // 获取文案记录
  const loadCaptionHistory = useCallback(async (keyword, setType, page = 1, append = false) => {
    if (page > 1) setCaptionHistoryLoading(true);
    try {
      const data = await apiFetchCaptionHistory({ keyword, setType, page, pageSize: 20 });
      setCaptionHistory(prev => append ? [...prev, ...(data.captions || [])] : (data.captions || []));
      setCaptionHistoryTotal(data.total || 0);
      setCaptionHistoryPage(page);
    } catch (err) {
      if (append) message.error('加载更多文案记录失败');
    } finally {
      if (page > 1) setCaptionHistoryLoading(false);
    }
  }, []);

  // 添加失败记录
  const addFailedCaption = useCallback((setType, imageIds, error) => {
    setFailedCaptions(prev => [{
      key: setType + '_' + Date.now(),
      setType,
      imageIds,
      error,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 10));
  }, []);

  // 移除失败记录
  const removeFailedCaption = useCallback((setType) => {
    setFailedCaptions(prev => prev.filter(fc => fc.setType !== setType));
  }, []);

  return {
    captionHistory,
    captionHistoryTotal,
    captionHistoryPage,
    captionHistoryLoading,
    captionKeyword,
    setCaptionKeyword,
    captionTypeFilter,
    setCaptionTypeFilter,
    failedCaptions,
    setFailedCaptions,
    generatedCaption,
    setGeneratedCaption,
    captionModalImages,
    setCaptionModalImages,
    loadCaptionHistory,
    addFailedCaption,
    removeFailedCaption
  };
}
