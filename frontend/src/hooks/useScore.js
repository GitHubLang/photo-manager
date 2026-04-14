import { useState, useCallback } from 'react';
import { message } from 'antd';
import { fetchScoreTasks, retryScoreTasks as apiRetryScoreTasks } from '../api/imageApi';

/**
 * 评分任务 hook
 * 封装：评分记录获取、重试、分页、失败记录管理
 */
export function useScore() {
  const [scoreTasks, setScoreTasks] = useState([]);
  const [scoreTasksTotal, setScoreTasksTotal] = useState(0);
  const [scoreTasksPage, setScoreTasksPage] = useState(1);
  const [scoreTasksLoading, setScoreTasksLoading] = useState(false);
  const [scoreTaskFilter, setScoreTaskFilter] = useState('all');
  const [selectedScoreTaskIds, setSelectedScoreTaskIds] = useState([]);
  const [failedScores, setFailedScores] = useState([]);

  // 获取评分记录
  const loadScoreTasks = useCallback(async (status, page = 1, append = false) => {
    // Only show loading indicator for page > 1 (load more), not filter changes
    if (page > 1) setScoreTasksLoading(true);
    try {
      const data = await fetchScoreTasks({
        status: status && status !== 'all' ? status : undefined,
        page,
        pageSize: 20
      });
      setScoreTasks(prev => append ? [...prev, ...(data.tasks || [])] : (data.tasks || []));
      setScoreTasksTotal(data.total || 0);
      setScoreTasksPage(page);
    } catch (err) {
      if (append) {
        message.error('加载更多评分记录失败');
      }
    } finally {
      if (page > 1) setScoreTasksLoading(false);
    }
  }, []);

  // 重试评分任务 (支持单个或批量)
  const retryScore = useCallback(async (imageIdOrIds) => {
    // Normalize to array - handles both single id and array of ids
    const ids = Array.isArray(imageIdOrIds) ? imageIdOrIds : [imageIdOrIds];
    if (!ids.length) return;

    try {
      await apiRetryScoreTasks(ids);
      message.success('已提交 ' + ids.length + ' 个评分任务');
      setSelectedScoreTaskIds([]);
      // Reload tasks with current filter
      loadScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter);
    } catch (err) {
      message.error('重试失败');
      throw err;
    }
  }, [scoreTaskFilter, loadScoreTasks]);

  // 添加失败记录
  const addFailedScore = useCallback((imageId, error) => {
    setFailedScores(prev => [{
      imageId,
      error,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 20)); // Keep max 20 records
  }, []);

  return {
    // State
    scoreTasks,
    scoreTasksTotal,
    scoreTasksPage,
    scoreTasksLoading,
    scoreTaskFilter,
    selectedScoreTaskIds,
    failedScores,
    // Setters
    setScoreTaskFilter,
    setSelectedScoreTaskIds,
    // Actions
    loadScoreTasks,
    retryScore,
    addFailedScore
  };
}