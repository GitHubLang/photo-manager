import { useState, useCallback } from 'react';
import { message } from 'antd';
import { fetchCaptionHistory as apiFetchCaptionHistory } from '../api/imageApi';

/**
 * 文案记录 hook
 * 封装：文案历史获取、搜索、分页、失败记录管理、弹窗状态
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
  const [captionModalVisible, setCaptionModalVisible] = useState(false);

  // 获取文案记录
  const loadCaptionHistory = useCallback(async (kw, tp, page = 1, append = false) => {
    const isLoadMore = page > 1;
    if (isLoadMore) setCaptionHistoryLoading(true);
    try {
      const data = await apiFetchCaptionHistory({ keyword: kw, setType: tp, page, pageSize: 20 });
      const items = data.captions || [];
      setCaptionHistory(prev => append ? [...prev, ...items] : items);
      setCaptionHistoryTotal(data.total || 0);
      setCaptionHistoryPage(page);
    } catch (err) {
      message.error(append ? '加载更多文案记录失败' : '加载文案记录失败');
    } finally {
      if (isLoadMore) setCaptionHistoryLoading(false);
    }
  }, []);

  // 添加失败记录 (setType, imageIds, error)
  const addFailedCaption = useCallback((setType, imageIds, error) => {
    const errorMsg = typeof error === 'string' ? error : (error?.message || '未知错误');
    setFailedCaptions(prev => {
      const newEntry = {
        key: setType + '_' + Date.now(),
        setType,
        imageIds,
        error: errorMsg,
        time: new Date().toLocaleTimeString()
      };
      return [newEntry, ...prev].slice(0, 10);
    });
  }, []);

  // 移除失败记录 (by setType)
  const removeFailedCaption = useCallback((setType) => {
    setFailedCaptions(prev => prev.filter(fc => fc.setType !== setType));
  }, []);

  return {
    // State
    captionHistory,
    captionHistoryTotal,
    captionHistoryPage,
    captionHistoryLoading,
    captionKeyword,
    captionTypeFilter,
    failedCaptions,
    generatedCaption,
    captionModalImages,
    captionModalVisible,

    // Setters
    setCaptionKeyword,
    setCaptionTypeFilter,
    setGeneratedCaption,
    setCaptionModalImages,
    setCaptionModalVisible,

    // Actions
    loadCaptionHistory,
    addFailedCaption,
    removeFailedCaption
  };
}
