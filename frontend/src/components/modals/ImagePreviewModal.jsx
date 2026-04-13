import React from 'react';
import { Modal, Image, Row, Col, Divider, Button, Tag, Card, Typography } from 'antd';
const { Title } = Typography;
import { DownloadOutlined } from '@ant-design/icons';
import { getProxyUrl } from '../../api/imageApi';

const DIMENSIONS = [
  { key: 'impact', label: '冲击力', weight: '25%' },
  { key: 'composition', label: '构图', weight: '25%' },
  { key: 'sharpness', label: '清晰度', weight: '20%' },
  { key: 'exposure', label: '曝光', weight: '15%' },
  { key: 'color', label: '色彩', weight: '10%' },
  { key: 'uniqueness', label: '独特性', weight: '5%' },
];

export default function ImagePreviewModal({ visible, image, onClose, onScore }) {
  if (!image) return null;
  const imageUrl = getProxyUrl(image.file_path);

  return (
    <Modal open={visible} onCancel={onClose} footer={null} width={1000} centered>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <Image src={imageUrl} alt={image.filename} style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain' }} preview={{ src: imageUrl }} />
        </div>
        <Divider />
        <Row gutter={16}>
          <Col span={8}>
            <Title level={5}>基本信息</Title>
            <p>ID: {image.id}</p>
            <p>文件名: {image.filename}</p>
            <p>尺寸: {image.width}x{image.height}</p>
            <p>方向: {image.orientation}</p>
          </Col>
          <Col span={16}>
            <Title level={5}>综合评分: {image.total_score ? '⭐ ' + image.total_score.toFixed(1) : '待评分'}</Title>
            <Button type="primary" onClick={() => { onScore(image.id); onClose(); }}>
              {image.total_score ? '重新评分' : '发起评分'}
            </Button>
          </Col>
        </Row>
        {image.impact_analysis && (
          <>
            <Divider />
            <Title level={5}>📊 详细评分分析</Title>
            <Row gutter={[16, 16]}>
              {DIMENSIONS.map(dim => (
                <Col span={12} key={dim.key}>
                  <Card size="small" title={dim.label + ' (' + dim.weight + ')'}>
                    <p>
                      <Tag color={image[dim.key + '_score'] >= 80 ? 'green' : image[dim.key + '_score'] >= 60 ? 'blue' : 'orange'}>
                        分数: {image[dim.key + '_score']?.toFixed(1) || '-'}
                      </Tag>
                    </p>
                    <p style={{ fontSize: 12, color: '#666' }}>分析: {image[dim.key + '_analysis'] || '-'}</p>
                    {image[dim.key + '_suggestion'] && (
                      <p style={{ fontSize: 12, color: '#1890ff' }}>💡 建议: {image[dim.key + '_suggestion']}</p>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}
        {image.description && (
          <>
            <Divider />
            <Title level={5}>📝 画面描述</Title>
            <p>{image.description}</p>
          </>
        )}
        {image.tags && (
          <div><Tag color="blue">{image.tags}</Tag></div>
        )}
      </div>
    </Modal>
  );
}
