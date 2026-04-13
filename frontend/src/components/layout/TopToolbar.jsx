import React from 'react';
import { Input, Button, Select, Space, Typography } from 'antd';
const { Title } = Typography;
import { CameraOutlined, ScanOutlined, SearchOutlined, MenuOutlined } from '@ant-design/icons';

export default function TopToolbar({ isMobile, searchText, onSearch, selectedModel, onModelChange, models, onScan, onMenuClick }) {
  if (isMobile) {
    return (
      <div className="top-toolbar">
        <Button type="text" icon={<MenuOutlined />} onClick={onMenuClick} style={{ marginRight: 8, minWidth: 44, height: 44 }} />
        <Title level={4} style={{ margin: 0, flex: 1 }}><CameraOutlined style={{ color: '#10b981', marginRight: 8 }} />摄影素材</Title>
        <Input.Search placeholder="搜索..." allowClear style={{ width: 160 }} onSearch={onSearch} />
      </div>
    );
  }

  return (
    <div className="top-toolbar">
      <Title level={4} style={{ margin: 0 }}>
        <CameraOutlined /> 摄影素材管理系统
      </Title>
      <Space>
        <Input.Search placeholder="搜索文件名、描述、标签..." allowClear style={{ width: 300 }} onSearch={onSearch} />
        <Select value={selectedModel} onChange={onModelChange} style={{ width: 200 }}>
          {models.map(m => <Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>)}
        </Select>
        <Button icon={<ScanOutlined />} onClick={onScan}>扫描</Button>
      </Space>
    </div>
  );
}
