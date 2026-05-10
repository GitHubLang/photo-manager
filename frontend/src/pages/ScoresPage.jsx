import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, Space, Checkbox, Spin, Empty, Select, Typography } from 'antd';
const { Text } = Typography;
import { getThumbnailUrl, getProxyUrl } from '../api/imageApi';
import ImagePreviewModal from '../components/modals/ImagePreviewModal';
import '../styles/scores.css';

/**
 * ScoresPage — 评分记录独立页面
 * 点击已完成的评分记录 → 在本页打开图片预览弹窗（不跳转到素材页）
 */
export default function ScoresPage({ scoreHook }) {
  const {
    scoreTasks, scoreTasksTotal, scoreTasksPage, scoreTasksLoading,
    scoreTaskFilter, setScoreTaskFilter,
    selectedScoreTaskIds, setSelectedScoreTaskIds,
    loadScoreTasks, retryScore,
  } = scoreHook;

  const [initialLoaded, setInitialLoaded] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (!initialLoaded) {
      loadScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter);
      setInitialLoaded(true);
    }
  }, [initialLoaded, loadScoreTasks, scoreTaskFilter]);

  const handleLoadMore = () => {
    if (!scoreTasksLoading && scoreTasks.length < scoreTasksTotal) {
      loadScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter, scoreTasksPage + 1, true);
    }
  };

  const handleImageClick = (task) => {
    if (!task.file_path) return;
    setPreviewImage({ ...task, imageUrl: getProxyUrl(task.file_path) });
    setPreviewVisible(true);
  };

  return (
    <div className="page-content scores-page">
      <div className="scores-page-header">
        <Space>
          <Select
            value={scoreTaskFilter}
            onChange={(v) => { setScoreTaskFilter(v); loadScoreTasks(v === 'all' ? null : v); }}
            style={{ width: 100 }}
            size="small"
          >
            <Select.Option value="all">全部</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
            <Select.Option value="processing">处理中</Select.Option>
            <Select.Option value="pending">待处理</Select.Option>
            <Select.Option value="completed">成功</Select.Option>
          </Select>
          <Button
            size="small"
            disabled={selectedScoreTaskIds.length === 0}
            onClick={() => retryScore(selectedScoreTaskIds)}
          >
            重试({selectedScoreTaskIds.length})
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>共{scoreTasksTotal}条</Text>
        </Space>
      </div>

      <Spin spinning={scoreTasksLoading}>
        {scoreTasks.length === 0 && scoreTasksTotal === 0 ? (
          <Empty description="暂无评分记录" />
        ) : (
          <div className="scores-list"
            onScroll={(e) => {
              const el = e.target;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
                handleLoadMore();
              }
            }}
          >
            {scoreTasks.map(task => {
              const status = String(task.status ?? '');
              const filename = String(task.filename ?? '');
              const imageId = Number(task.image_id) || 0;
              const errorMsg = task.error_message != null ? String(task.error_message) : '';
              const filePath = task.file_path != null ? String(task.file_path) : '';
              const isCompleted = status === 'completed';
              const tagColor = status === 'failed' ? 'red'
                : status === 'completed' ? 'green'
                : status === 'processing' ? 'orange' : 'blue';
              const tagText = status === 'processing' ? '处理中'
                : status === 'failed' ? '失败'
                : status === 'completed' ? '成功' : status;

              return (
                <Card
                  key={String(task.id)}
                  size="small"
                  hoverable={!isCompleted}
                  style={{ opacity: isCompleted ? 0.6 : 1 }}
                  cover={filePath ? (
                    <img src={getThumbnailUrl(filePath, 100)} alt={filename}
                      style={{ height: 60, objectFit: 'cover' }} />
                  ) : null}
                  onClick={() => {
                    if (isCompleted) {
                      handleImageClick(task);
                    } else {
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
                      <Text ellipsis style={{ fontSize: 12 }}>
                        {filename || 'ID:' + imageId}
                      </Text>
                      <Tag color={tagColor} style={{ fontSize: 10 }}>{tagText}</Tag>
                      {errorMsg && (
                        <Text type="danger" style={{ fontSize: 10, display: 'block' }} ellipsis>
                          {errorMsg}
                        </Text>
                      )}
                    </div>
                    {!isCompleted && (
                      <Button size="small" onClick={(e) => { e.stopPropagation(); retryScore([imageId]); }}>
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

      <div className="scores-pagination">
        <Space>
          <Button size="small" disabled={scoreTasksPage <= 1}
            onClick={() => loadScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter, scoreTasksPage - 1)}>
            上一页
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>{scoreTasksPage}</Text>
          <Button size="small" disabled={scoreTasks.length < 20}
            onClick={() => loadScoreTasks(scoreTaskFilter === 'all' ? null : scoreTaskFilter, scoreTasksPage + 1)}>
            下一页
          </Button>
        </Space>
      </div>

      <ImagePreviewModal
        visible={previewVisible}
        image={previewImage}
        onClose={() => setPreviewVisible(false)}
      />
    </div>
  );
}
