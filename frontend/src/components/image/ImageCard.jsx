import React from 'react';
const { Text } = Typography;
import { Card, Tag, Tooltip, Checkbox, Typography } from 'antd';
import { DownloadOutlined, MessageOutlined } from '@ant-design/icons';
import { getThumbnailUrl, getProxyUrl } from '../../api/imageApi';

const getScoreColor = (score) => {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#1890ff';
  if (score >= 40) return '#faad14';
  return '#f5222d';
};

export default function ImageCard({ img, selected, scoringIds, onSelect, onPreview, onScore, onDownload }) {
  const isSelected = selected.some(item => (item.id || item) === img.id);
  const isScoring = scoringIds?.has(img.id);

  return (
    <Card hoverable className={'image-card ' + (isSelected ? 'selected' : '')}
      cover={
        <div className="image-cover" onClick={() => { onSelect(img); onPreview && onPreview(img); }}>
          <img src={getThumbnailUrl(img.file_path, 400)} alt={img.filename} />
          <Tooltip title={'评分: ' + (img.total_score ? img.total_score.toFixed(1) : isScoring ? '评分中...' : '待评分') + (img.score_count ? ' (' + img.score_count + '次)' : '')}>
            <div className="image-score" style={{ backgroundColor: getScoreColor(img.total_score) }}>
              {img.total_score ? '⭐ ' + img.total_score.toFixed(1) : isScoring ? '评分中' : '待评分'}
            </div>
          </Tooltip>
          <div className="image-check" onClick={(e) => { e.stopPropagation(); onSelect(img); }}>
            {isSelected ? <Checkbox checked /> : null}
          </div>
        </div>
      }
      actions={[
        <Tooltip title="评分" key="score">
          <MessageOutlined onClick={() => onScore(img.id)} />
        </Tooltip>,
        <Tooltip title="下载原图" key="download">
          <DownloadOutlined onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDownload && onDownload(img); }} />
        </Tooltip>,
      ]}
    >
      <Card.Meta
        title={<Text ellipsis>{img.filename}</Text>}
        description={
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {img.width}x{img.height} | {(img.file_size / 1024 / 1024).toFixed(1)}MB
            </Text>
            {img.tags && (
              <div style={{ marginTop: 4 }}>
                {img.tags.split(',').slice(0, 3).map((tag, i) => (
                  <Tag key={i} size="small">{tag.trim()}</Tag>
                ))}
              </div>
            )}
          </div>
        }
      />
    </Card>
  );
}
