import React from 'react';
import { Modal, Space, Tag, Divider, Typography } from 'antd';
const { Title } = Typography;

export default function ThemeModal({ visible, theme, onClose }) {
  if (!theme) return null;

  return (
    <Modal open={visible} onCancel={onClose} footer={null} width={600} title="每日主题">
      <Title level={3}>{theme.theme?.theme_title}</Title>
      <p>{theme.theme?.theme_description}</p>
      <Divider />
      <Space>
        <Tag color="blue">照片数: {theme.photo_count}</Tag>
        <Tag color="green">平均分: {theme.avg_score}</Tag>
      </Space>
      <Divider />
      <strong>关键词: </strong>
      <span>{theme.theme?.keywords}</span>
    </Modal>
  );
}
