import React from 'react';
const { Text } = Typography;
import { Card, Tag, Button, Space, Checkbox, Spin, Empty, Select, Typography } from 'antd';
import { getThumbnailUrl } from '../../api/imageApi';

// 移动端抽屉（评分记录）
export function ScoreDrawer({ open, onClose, scoreTasks, scoreTasksTotal, scoreTasksLoading, scoreTaskFilter, setScoreTaskFilter, selectedIds, setSelectedIds, onLoadMore, onRetry, currentPage }) {
  return (
    <div className={'score-panel ' + (open ? 'open' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="score-panel-backdrop" onClick={onClose} />
      <div className="score-panel-content">
        <div className="folder-drawer-header">
          <Text strong>评分记录</Text>
          <Button type="text" size="small" onClick={onClose}>关闭</Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}
          onScroll={e => {
            const el = e.target;
            const { scrollTop, scrollHeight, clientHeight } = el;
            if (scrollHeight - scrollTop - clientHeight < 100 && !scoreTasksLoading && scoreTasks.length < scoreTasksTotal) {
              const prevHeight = scrollHeight;
              onLoadMore().then(() => { requestAnimationFrame(() => { el.scrollTop = scrollTop + (el.scrollHeight - prevHeight); }); });
            }
          }}>
          <Space style={{ marginBottom: 10, flexWrap: 'wrap' }}>
            <Select value={scoreTaskFilter} onChange={(v) => { setScoreTaskFilter(v); }} style={{ width: 90 }} size="small" popupMatchSelectWidth={false}
              styles={{ popup: { root: { position: 'fixed', zIndex: 1300 } }}}>
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="failed">失败</Select.Option>
            </Select>
            <Button size="small" disabled={selectedIds.length === 0} onClick={() => onRetry(selectedIds)}>重试({selectedIds.length})</Button>
          </Space>
          <Spin spinning={scoreTasksLoading}>
            {scoreTasks.length === 0 ? <Empty description="暂无记录" /> : scoreTasks.map(task => (
              <Card key={String(task.id)} size="small" hoverable style={{ marginBottom: 8, opacity: String(task.status ?? '') === 'completed' ? 0.6 : 1 }}
                cover={task.file_path ? <img src={getThumbnailUrl(String(task.file_path), 100)} alt={String(task.filename ?? '')} style={{ height: 60, objectFit: 'cover' }} /> : null}
                onClick={() => {
                  if (String(task.status ?? '') !== 'completed') {
                    setSelectedIds(prev => prev.includes(Number(task.image_id)) ? prev.filter(id => id !== Number(task.image_id)) : [...prev, Number(task.image_id)]);
                  }
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {String(task.status ?? '') !== 'completed' && <Checkbox checked={selectedIds.includes(Number(task.image_id))} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text ellipsis style={{ fontSize: 12 }}>{String(task.filename ?? '') || 'ID:' + Number(task.image_id) || 0}</Text>
                    <Tag color={String(task.status ?? '') === 'failed' ? 'red' : String(task.status ?? '') === 'completed' ? 'green' : 'orange'} style={{ fontSize: 10 }}>
                      {String(task.status ?? '') === 'processing' ? '处理中' : String(task.status ?? '') === 'failed' ? '失败' : String(task.status ?? '')}
                    </Tag>
                  </div>
                  {String(task.status ?? '') !== 'completed' && <Button size="small" onClick={(e) => { e.stopPropagation(); onRetry([Number(task.image_id)]); }}>重试</Button>}
                </div>
              </Card>
            ))}
          </Spin>
        </div>
      </div>
    </div>
  );
}

// PC端侧边栏（评分记录）
export function ScorePanel({ tasks, total, loading, page, filter, setFilter, selectedIds, setSelectedIds, onLoad, onRetry, onPageChange, onSelectAll }) {
  return (
    <div style={{ width: 300, borderLeft: '1px solid #f0f0f0', padding: 12, overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text strong>评分记录</Text>
        <Button type="text" size="small" onClick={onPageChange}>收起</Button>
      </div>
      <Space style={{ marginBottom: 10 }}>
        <Select value={filter} onChange={(v) => { setFilter(v); onLoad(v === 'all' ? null : v); }} style={{ width: 90 }} size="small">
          <Select.Option value="all">全部</Select.Option>
          <Select.Option value="failed">失败</Select.Option>
          <Select.Option value="processing">处理中</Select.Option>
          <Select.Option value="pending">待处理</Select.Option>
          <Select.Option value="completed">成功</Select.Option>
        </Select>
        <Button size="small" disabled={selectedIds.length === 0} onClick={() => onRetry(selectedIds)}>重试({selectedIds.length})</Button>
        <Button size="small" onClick={() => setSelectedIds(tasks.map(t => t.image_id))}>全选</Button>
        <Text type="secondary" style={{ fontSize: 11 }}>共{total}条</Text>
      </Space>
      <Spin spinning={loading}>
        {tasks.length === 0 && total === 0 ? (
          <Empty description="暂无记录" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.map(task => {
              const status = String(task.status ?? '');
              const filename = String(task.filename ?? '');
              const imageId = Number(task.image_id) || 0;
              const errorMsg = task.error_message != null ? String(task.error_message) : '';
              const filePath = task.file_path != null ? String(task.file_path) : '';
              const isCompleted = status === 'completed';
              const tagColor = status === 'failed' ? 'red' : status === 'completed' ? 'green' : status === 'processing' ? 'orange' : 'blue';
              const tagText = status === 'processing' ? '处理中' : status === 'failed' ? '失败' : status === 'completed' ? '成功' : status;
              return (
                <Card key={String(task.id)} size="small" hoverable={!isCompleted} style={{ opacity: isCompleted ? 0.6 : 1 }}
                  cover={filePath ? <img src={getThumbnailUrl(filePath, 100)} alt={filename || 'ID:' + imageId} style={{ height: 60, objectFit: 'cover' }} /> : null}
                  onClick={() => {
                    if (!isCompleted) setSelectedIds(prev => prev.includes(imageId) ? prev.filter(id => id !== imageId) : [...prev, imageId]);
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!isCompleted && <Checkbox checked={selectedIds.includes(imageId)} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text ellipsis style={{ fontSize: 12 }}>{filename || 'ID:' + imageId}</Text>
                      <Tag color={tagColor} style={{ fontSize: 10 }}>{tagText}</Tag>
                      {errorMsg && <Text type="danger" style={{ fontSize: 10 }} ellipsis>{errorMsg}</Text>}
                    </div>
                    {!isCompleted && <Button size="small" onClick={(e) => { e.stopPropagation(); onRetry([imageId]); }}>重试</Button>}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Spin>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Space>
          <Button size="small" disabled={page <= 1} onClick={() => onLoad(filter === 'all' ? null : filter, page - 1)}>上页</Button>
          <Text type="secondary" style={{ fontSize: 11 }}>{page}</Text>
          <Button size="small" disabled={tasks.length < 20} onClick={() => onLoad(filter === 'all' ? null : filter, page + 1)}>下页</Button>
        </Space>
      </div>
    </div>
  );
}
