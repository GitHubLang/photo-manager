import React, { useState, useEffect } from 'react';
import { Tabs, Typography } from 'antd';
const { Title, Text } = Typography;
import GeneralSettings from '../components/settings/GeneralSettings';
import ModelManagement from '../components/modals/ModelManagement';
import ThemeSwitcher from '../components/settings/ThemeSwitcher';
import '../styles/settings.css';

/**
 * SettingsPage — 设置聚合页
 * subTab prop 控制初始 tab: 'settings-general' | 'settings-models' | 'settings-theme'
 */
export default function SettingsPage({ subTab }) {
  const TAB_MAP = {
    'settings-general': 'general',
    'settings-models': 'models',
    'settings-theme': 'theme',
  };

  const [activeTab, setActiveTab] = useState(TAB_MAP[subTab] || 'general');

  useEffect(() => {
    if (subTab && TAB_MAP[subTab]) {
      setActiveTab(TAB_MAP[subTab]);
    }
  }, [subTab]);

  return (
    <div className="page-content settings-page">
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>设置</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        AI 模型配置、主题切换等全局设置
      </Text>
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={[
          { key: 'general', label: '通用设置', children: <GeneralSettings /> },
          { key: 'models', label: '模型管理', children: <ModelManagement /> },
          { key: 'theme', label: '主题切换', children: <ThemeSwitcher /> },
        ]} />
    </div>
  );
}
