import React from 'react';
import { Row, Col, Spin, Empty } from 'antd';
import ImageCard from './ImageCard';

export default function ImageGrid({ images, loading, selectedImages, scoringIds, onSelect, onPreview, onScore, onDownload }) {
  if (images.length === 0) {
    return <Empty description={loading ? '' : '选择一个文件夹开始'} />;
  }

  return (
    <Spin spinning={loading}>
      <Row gutter={[16, 16]} className="image-grid">
        {images.map(img => (
          <Col key={img.id} xs={12} sm={8} md={6} lg={4}>
            <ImageCard
              img={img}
              selected={selectedImages}
              scoringIds={scoringIds}
              onSelect={onSelect}
              onPreview={onPreview}
              onScore={onScore}
              onDownload={onDownload}
            />
          </Col>
        ))}
      </Row>
    </Spin>
  );
}
