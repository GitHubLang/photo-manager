import React from 'react';
const { Text } = Typography;
import { Card, Tag, Button, Space, Spin, Empty, Select, Input, Divider, Typography } from 'antd';
import { getThumbnailUrl } from '../../api/imageApi';

// 移动端抽屉
export function CaptionDrawer({ open, onClose, history, total, loading, page, keyword, setKeyword, typeFilter, setTypeFilter, onLoad, onLoadMore }) {
  return (
    <div className={'caption-panel ' + (open ? 'open' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="caption-panel-backdrop" onClick={onClose} />
      <div className="caption-panel-content">
        <div className="folder-drawer-header caption-panel-header">
          <Text strong>文案记录</Text>
          <Button type="text" size="small" onClick={onClose}>关闭</Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}
          onScroll={e => {
            const el = e.target;
            const { scrollTop, scrollHeight, clientHeight } = el;
            if (scrollHeight - scrollTop - clientHeight < 100 && !loading && history.length < total) {
              const prevHeight = scrollHeight;
              onLoadMore().then(() => { requestAnimationFrame(() => { el.scrollTop = scrollTop + (el.scrollHeight - prevHeight); }); });
            }
          }}>
          <Space style={{ marginBottom: 10 }}>
            <Input.Search placeholder="搜索..." value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={v => onLoad(v, typeFilter)} style={{ width: 120 }} size="small" />
            <Select value={typeFilter} onChange={v => { setTypeFilter(v); onLoad(keyword, v); }} style={{ width: 80 }} size="small" allowClear placeholder="类型" popupMatchSelectWidth={false}
              styles={{ popup: { root: { position: 'fixed', zIndex: 1300 } }}}>
              <Select.Option value="douyin">抖音</Select.Option>
              <Select.Option value="xiaohongshu">小红书</Select.Option>
            </Select>
          </Space>
          <Spin spinning={loading}>
            {history.length === 0 ? <Empty description="暂无文案" /> : history.map(cap => (
              <Card key={cap.id} size="small" hoverable style={{ marginBottom: 8 }}
                cover={cap.cover_filename ? <img src={getThumbnailUrl(cap.cover_filename, 100)} alt={cap.caption_title} style={{ height: 60, objectFit: 'cover' }} /> : null}
                onClick={() => {}}>
                <Space style={{ marginBottom: 4 }}>
                  <Tag color={cap.set_type === 'douyin' ? 'blue' : 'green'} style={{ fontSize: 10 }}>{cap.set_type === 'douyin' ? '抖音' : '小红书'}</Tag>
                  <Text type="secondary" style={{ fontSize: 10 }}>{cap.date}</Text>
                </Space>
                <Text strong style={{ fontSize: 13 }}>{cap.caption_title || '(无标题)'}</Text>
              </Card>
            ))}
          </Spin>
        </div>
      </div>
    </div>
  );
}

// PC端侧边栏
export function CaptionPanel({ history, total, loading, page, keyword, setKeyword, typeFilter, setTypeFilter, onLoad, onPageChange, onImageClick }) {
  return (
    <div style={{ width: 320, borderLeft: '1px solid #f0f0f0', padding: 12, overflowY: 'auto', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text strong>文案记录</Text>
        <Button type="text" size="small" onClick={onPageChange}>收起</Button>
      </div>
      <Space style={{ marginBottom: 10 }}>
        <Input.Search placeholder="搜索图片ID、文案..." value={keyword} onChange={e => setKeyword(e.target.value)} onSearch={v => onLoad(v, typeFilter)} style={{ width: 160 }} size="small" />
        <Select value={typeFilter} onChange={v => { setTypeFilter(v); onLoad(keyword, v); }} style={{ width: 90 }} size="small" allowClear placeholder="类型">
          <Select.Option value="douyin">抖音</Select.Option>
          <Select.Option value="xiaohongshu">小红书</Select.Option>
        </Select>
      </Space>
      <Spin spinning={loading}>
        {history.length === 0 ? (
          <Empty description="暂无文案" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(cap => (
              <Card key={cap.id} size="small" hoverable
                cover={cap.cover_filename ? <img src={getThumbnailUrl(cap.cover_filename, 100)} alt={cap.caption_title} style={{ height: 60, objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} /> : null}
                onClick={() => onImageClick && onImageClick(cap)}>
                <div>
                  <Space style={{ marginBottom: 4 }}>
                    <Tag color={cap.set_type === 'douyin' ? 'blue' : 'green'} style={{ fontSize: 10 }}>
                      {cap.set_type === 'douyin' ? '抖音' : '小红书'}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 10 }}>{cap.date}</Text>
                  </Space>
                  <Text strong style={{ fontSize: 13 }}>{cap.caption_title || '(无标题)'}</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                    {cap.image_ids ? JSON.parse(cap.image_ids).length + '张图片' : ''}
                  </Text>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Spin>
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <Space>
          <Button size="small" disabled={page <= 1} onClick={() => onLoad(keyword, typeFilter, page - 1)}>上页</Button>
          <Text type="secondary" style={{ fontSize: 11 }}>{page}</Text>
          <Button size="small" disabled={history.length < 20} onClick={() => onLoad(keyword, typeFilter, page + 1)}>下页</Button>
          <Text type="secondary" style={{ fontSize: 11 }}>共{total}条</Text>
        </Space>
      </div>
    </div>
  );
}
