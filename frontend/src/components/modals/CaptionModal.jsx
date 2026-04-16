import React from 'react';
const { Title } = Typography;
import { Modal, Divider, Button, Tag, Space, Typography } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

export default function CaptionModal({ visible, caption, images, onClose, onImageClick, getProxyUrl }) {
  if (!caption) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const captionContent = caption.content || caption.description || caption.text || caption.caption || '(无内容)';
  const captionTitle = caption.title || '(无标题)';
  const hashtags = (caption.hashtags || '').split(/[\s,]+/).filter(Boolean);
  const fullText = captionTitle + String.fromCharCode(10,10) + captionContent + String.fromCharCode(10,10) + (caption.hashtags || '');

  return (
    <Modal open={visible} onCancel={onClose} footer={null} width={660}
      title={caption.setType === 'douyin' ? '抖音文案' : '小红书文案'}>
      {images && images.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 16 }}>
            {images.map(img => (
              <div key={img.id} style={{ position: 'relative', paddingTop: '100%', overflow: 'hidden', background: '#f0f0f0', cursor: 'pointer' }}
                onClick={() => onImageClick && onImageClick(img)}>
                <img src={getProxyUrl(img.file_path) + '?size=300'} alt={img.filename}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.target.style.opacity = 0; }} />
              </div>
            ))}
          </div>
          <Divider style={{ margin: '12px 0' }} />
        </>
      )}
      <Title level={4}>{captionTitle}</Title>
      <Divider />
      <p style={{ whiteSpace: 'pre-wrap' }}>{captionContent}</p>
      <Divider />
      <div>{hashtags.map((tag, i) => <Tag key={i} color='blue'>{tag}</Tag>)}</div>
      <Divider />
      <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(fullText)}>
        复制文案
      </Button>
    </Modal>
  );
}