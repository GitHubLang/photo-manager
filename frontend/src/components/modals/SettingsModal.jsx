import React, { useState } from 'react';
import { Modal, Tabs } from 'antd';
import ModelManagement from './ModelManagement';

export default function SettingsModal({ visible, onClose }) {
  const [activeTab, setActiveTab] = useState('model');

  const items = [
    {
      key: 'model',
      label: '模型管理',
      children: <ModelManagement />,
    },
    {
      key: 'general',
      label: '通用',
      children: <div style={{ padding: 20, color: '#666' }}>通用设置占位...</div>,
    },
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
      title="设置"
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
      />
    </Modal>
  );
}
