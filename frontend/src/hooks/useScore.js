import { useState, useCallback } from 'react';
import { message } from 'antd';
import { fetchScoreTasks, retryScoreTasks as apiRetryScoreTasks } from '../api/imageApi';

/**
 * 评分任务 hook
 * 封装：评分记录获取、重试、分页
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
    if (page > 1) setScoreTasksLoading(true);
    try {
      const data = await fetchScoreTasks({ status: status && status !== 'all' ? status : undefined, page, pageSize: 20 });
      setScoreTasks(prev => append ? [...prev, ...(data.tasks || [])] : (data.tasks || []));
      setScoreTasksTotal(data.total || 0);
      setScoreTasksPage(page);
    } catch (err) {
      if (append) message.error('加载更多评分记录失败');
    } finally {
      if (page > 1) setScoreTasksLoading(false);
    }
  }, []);

  // 重试评分
  const retryScore = useCallback(async (imageIds) => {
    if (!imageIds || imageIds.length === 0) return;
    try {
      await apiRetryScoreTasks(imageIds);
      message.success('已提交 ' + imageIds.length + ' 个评分任务');
      setSelectedScoreTaskIds([]);
      loadScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter);
    } catch (err) {
      message.error('重试失败');
    }
  }, [scoreTaskFilter, loadScoreTasks]);

  // 添加失败记录
  const addFailedScore = useCallback((imageId, error) => {
    setFailedScores(prev => [{
      imageId,
      error,
      time: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 20));
  }, []);

  return {
    scoreTasks,
    scoreTasksTotal,
    scoreTasksPage,
    scoreTasksLoading,
    scoreTaskFilter,
    selectedScoreTaskIds,
    setSelectedScoreTaskIds,
    setScoreTaskFilter,
    failedScores,
    setFailedScores,
    loadScoreTasks,
    retryScore,
    addFailedScore
  };
}
