import React, { useEffect, useState } from 'react';
import { Card, Tag, Button, Space, Spin, Empty, Select, Input, Typography } from 'antd';
const { Text } = Typography;
import { getThumbnailUrl, fetchBatchImages } from '../api/imageApi';
import '../styles/captions.css';

/**
 * CaptionsPage — 文案记录独立页面
 * PC 和移动端共享同一代码
 */
export default function CaptionsPage({ captionHook }) {
  const {
    captionHistory, captionHistoryTotal, captionHistoryPage, captionHistoryLoading,
    captionKeyword, setCaptionKeyword,
    captionTypeFilter, setCaptionTypeFilter,
    loadCaptionHistory,
    setGeneratedCaption, setCaptionModalImages, setCaptionModalVisible,
  } = captionHook;

  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    if (!initialLoaded) {
      loadCaptionHistory(captionKeyword, captionTypeFilter);
      setInitialLoaded(true);
    }
  }, [initialLoaded, loadCaptionHistory, captionKeyword, captionTypeFilter]);

  const handleSearch = (kw) => {
    setCaptionKeyword(kw);
    loadCaptionHistory(kw, captionTypeFilter);
  };

  const handleTypeChange = (tp) => {
    setCaptionTypeFilter(tp);
    loadCaptionHistory(captionKeyword, tp);
  };

  const handleImageClick = (cap) => {
    const parsedIds = cap.image_ids ? JSON.parse(cap.image_ids) : [];
    setGeneratedCaption({
      ...cap,
      title: cap.caption_title,
      setType: cap.set_type,
      content: cap.caption_body,
      hashtags: cap.hashtags,
    });
    fetchBatchImages(parsedIds)
      .then(d => setCaptionModalImages(d.images || []))
      .catch(() => setCaptionModalImages([]));
    setCaptionModalVisible(true);
  };

  return (
    <div className="page-content captions-page">
      <div className="captions-page-header">
        <Space>
          <Input.Search
            placeholder="搜索图片ID、文案..."
            value={captionKeyword}
            onChange={e => setCaptionKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 200 }}
            size="small"
          />
          <Select
            value={captionTypeFilter}
            onChange={handleTypeChange}
            style={{ width: 100 }}
            size="small"
            allowClear
            placeholder="类型"
          >
            <Select.Option value="douyin">抖音</Select.Option>
            <Select.Option value="xiaohongshu">小红书</Select.Option>
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>共{captionHistoryTotal}条</Text>
        </Space>
      </div>

      <Spin spinning={captionHistoryLoading}>
        {captionHistory.length === 0 ? (
          <Empty description="暂无文案" />
        ) : (
          <div
            className="captions-list"
            onScroll={(e) => {
              const el = e.target;
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 200
                && !captionHistoryLoading
                && captionHistory.length < captionHistoryTotal) {
                loadCaptionHistory(captionKeyword, captionTypeFilter, captionHistoryPage + 1, true);
              }
            }}
          >
            {captionHistory.map(cap => (
              <Card
                key={cap.id}
                size="small"
                hoverable
                style={{ marginBottom: 8 }}
                cover={cap.cover_filename ? (
                  <img src={getThumbnailUrl(cap.cover_filename, 100)} alt={cap.caption_title}
                    style={{ height: 60, objectFit: 'cover' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                ) : null}
                onClick={() => handleImageClick(cap)}
              >
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

      <div className="captions-pagination">
        <Space>
          <Button size="small" disabled={captionHistoryPage <= 1}
            onClick={() => loadCaptionHistory(captionKeyword, captionTypeFilter, captionHistoryPage - 1)}>
            上一页
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>{captionHistoryPage}</Text>
          <Button size="small" disabled={captionHistory.length < 20}
            onClick={() => loadCaptionHistory(captionKeyword, captionTypeFilter, captionHistoryPage + 1)}>
            下一页
          </Button>
        </Space>
      </div>
    </div>
  );
}
