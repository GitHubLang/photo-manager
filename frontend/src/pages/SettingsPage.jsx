import React from 'react';
import { Typography } from 'antd';
const { Title, Text } = Typography;
import GeneralSettings from '../components/settings/GeneralSettings';
import PhotoDirectoriesSettings from '../components/settings/PhotoDirectoriesSettings';
import ModelManagement from '../components/modals/ModelManagement';
import ThemeSwitcher from '../components/settings/ThemeSwitcher';
import '../styles/settings.css';

const SUB_PAGES = {
  'settings-general': { title: '通用设置', desc: '默认模型、BGM 等全局配置', Comp: GeneralSettings },
  'settings-photo-dirs': { title: '照片目录', desc: '管理照片扫描根目录，支持多目录和递归扫描', Comp: PhotoDirectoriesSettings },
  'settings-models':  { title: '模型管理', desc: '配置 AI 模型 API 端点和密钥', Comp: ModelManagement },
  'settings-theme':   { title: '主题切换', desc: '界面主题配置', Comp: ThemeSwitcher },
};

/**
 * SettingsPage — 设置入口页 / 子页面渲染
 * subTab 决定渲染哪个子组件，无 subTab 时显示菜单引导
 */
export default function SettingsPage({ subTab, onNavigate }) {
  // 无子页时显示入口列表
  if (!subTab || !SUB_PAGES[subTab]) {
    return (
      <div className="page-content settings-page">
        <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>设置</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          AI 模型配置、主题切换等全局设置
        </Text>
        {Object.entries(SUB_PAGES).map(([key, { title, desc }]) => (
          <div
            key={key}
            onClick={() => onNavigate(key)}
            style={{
              padding: '16px 20px', marginBottom: 12,
              background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)', cursor: 'pointer',
              transition: 'border-color var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <Text strong style={{ fontSize: 15 }}>{title}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>{desc}</Text>
          </div>
        ))}
      </div>
    );
  }

  // 子页面
  const { title, desc, Comp } = SUB_PAGES[subTab];
  return (
    <div className="page-content settings-page">
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ cursor: 'pointer', fontSize: 13 }}
          onClick={() => onNavigate('settings')}>
          ← 返回设置
        </Text>
      </div>
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>{title}</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>{desc}</Text>
      <Comp />
    </div>
  );
}
