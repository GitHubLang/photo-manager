import React, { useState, useEffect } from 'react';
import { Tabs, Select, Button, message, Typography, Divider } from 'antd';
const { Text, Title } = Typography;
import { fetchModels } from '../api/imageApi';
import ModelManagement from '../components/modals/ModelManagement';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';

function getStored(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function setStored(key, val) {
  try { localStorage.setItem(key, val); } catch {} 
}

const tabKeyMap = {
  'settings-general': 'general',
  'settings-models': 'model',
};

export default function SettingsPage({ activeMenu }) {
  const initialTab = tabKeyMap[activeMenu] || 'model';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [models, setModels] = useState([]);
  const [scoringModel, setScoringModel] = useState(getStored(LS_SCORING));
  const [captionModel, setCaptionModel] = useState(getStored(LS_CAPTION));

  // 从菜单栏切换 tab
  useEffect(() => {
    if (tabKeyMap[activeMenu]) {
      setActiveTab(tabKeyMap[activeMenu]);
    }
  }, [activeMenu]);

  useEffect(() => {
    fetchModels().then(d => setModels(d.models || [])).catch(() => {});
    setScoringModel(getStored(LS_SCORING));
    setCaptionModel(getStored(LS_CAPTION));
  }, []);

  const handleSave = () => {
    setStored(LS_SCORING, scoringModel);
    setStored(LS_CAPTION, captionModel);
    message.success('设置已保存');
  };

  const modelOptions = models.map(m => ({
    value: m.name,
    label: m.name
  }));

  const items = [
    {
      key: 'model',
      label: '模型管理',
      children: <ModelManagement />,
    },
    {
      key: 'general',
      label: '通用',
      children: (
        <div style={{ padding: 20, maxWidth: 600 }}>
          <Text strong>默认模型设置</Text>
          <Divider />
          <div style={{ marginBottom: 16 }}>
            <Text>评分模型：</Text>
            <Select
              value={scoringModel}
              onChange={setScoringModel}
              options={modelOptions}
              style={{ width: 300, marginLeft: 12 }}
              placeholder="选择评分使用的模型"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>文案模型：</Text>
            <Select
              value={captionModel}
              onChange={setCaptionModel}
              options={modelOptions}
              style={{ width: 300, marginLeft: 12 }}
              placeholder="选择文案生成使用的模型"
            />
          </div>
          <Button type="primary" onClick={handleSave}>保存设置</Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 960, width: '100%', margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>设置</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        全局配置与模型管理
      </Text>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
      />
    </div>
  );
}
