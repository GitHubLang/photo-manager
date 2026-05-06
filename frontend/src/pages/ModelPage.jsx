import React from 'react';
import { Typography } from 'antd';
const { Text, Title } = Typography;
import ModelManagement from '../components/modals/ModelManagement';

export default function ModelPage() {
  return (
    <div style={{ padding: 24, maxWidth: 960, width: '100%', margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>模型管理</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        配置 AI 模型，支持自定义 API 端点和密钥
      </Text>
      <ModelManagement />
    </div>
  );
}
