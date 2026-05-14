import React from 'react';
import { Typography } from 'antd';
const { Title, Text } = Typography;
import { SettingOutlined, FolderOutlined, RobotOutlined, BgColorsOutlined } from '@ant-design/icons';
import GeneralSettings from '../components/settings/GeneralSettings';
import PhotoDirectoriesSettings from '../components/settings/PhotoDirectoriesSettings';
import ModelManagement from '../components/modals/ModelManagement';
import ThemeSwitcher from '../components/settings/ThemeSwitcher';
import '../styles/settings.css';

const SUB_PAGES = {
  'settings-general': {
    title: '通用设置', desc: '默认模型、BGM 等全局配置',
    icon: SettingOutlined, Comp: GeneralSettings,
  },
  'settings-photo-dirs': {
    title: '照片目录', desc: '管理照片扫描根目录，支持多目录和递归扫描',
    icon: FolderOutlined, Comp: PhotoDirectoriesSettings,
  },
  'settings-models': {
    title: '模型管理', desc: '配置 AI 模型 API 端点和密钥',
    icon: RobotOutlined, Comp: ModelManagement,
  },
  'settings-theme': {
    title: '主题切换', desc: '界面主题配置',
    icon: BgColorsOutlined, Comp: ThemeSwitcher,
  },
};

/**
 * SettingsPage — 设置入口页 / 子页面渲染
 */
export default function SettingsPage({ subTab, onNavigate }) {
  // 子页面
  if (subTab && SUB_PAGES[subTab]) {
    const { title, Comp } = SUB_PAGES[subTab];
    return (
      <div className="page-content settings-page">
        <div className="settings-page-inner">
          <div className="settings-sub-header">
            <span className="settings-back-link" onClick={() => onNavigate('settings')}>
              ← 设置
            </span>
            <span className="settings-sub-title">{title}</span>
          </div>
          <Comp />
        </div>
      </div>
    );
  }

  // 主页：设置菜单入口
  return (
    <div className="page-content settings-page">
      <div className="settings-page-inner">
        <div className="settings-home-header">
          <Title level={3} style={{ margin: 0, fontWeight: 600 }}>设置</Title>
          <Text type="secondary" style={{ marginTop: 4 }}>AI 模型配置、目录管理、主题切换等</Text>
        </div>
        <div className="settings-home-list">
          {Object.entries(SUB_PAGES).map(([key, { title, desc, icon: Icon }]) => (
            <div key={key} className="settings-home-card" onClick={() => onNavigate(key)}>
              <div className="settings-home-card-icon">
                <Icon />
              </div>
              <div className="settings-home-card-body">
                <span className="settings-home-card-title">{title}</span>
                <span className="settings-home-card-desc">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
