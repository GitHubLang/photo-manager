import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Select, Space, Button, message, Typography, Divider } from 'antd';
const { Text } = Typography;
import { fetchModels } from '../../api/imageApi';
import ModelManagement from './ModelManagement';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';

function getStored(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function setStored(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

export default function SettingsModal({ visible, initialTab = 'general', onClose }) {
  const [activeTab, setActiveTab] = useState(initialTab);

  // 当 initialTab 变化时切换 tab（从菜单栏跳转）
  useEffect(() => {
    if (visible && initialTab) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);
  const [models, setModels] = useState([]);
  const [scoringModel, setScoringModel] = useState(getStored(LS_SCORING));
  const [captionModel, setCaptionModel] = useState(getStored(LS_CAPTION));

  useEffect(() => {
    if (visible) {
      fetchModels().then(d => setModels(d.models || [])).catch(() => {});
      setScoringModel(getStored(LS_SCORING));
      setCaptionModel(getStored(LS_CAPTION));
    }
  }, [visible]);

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
        <div style={{ padding: 20 }}>
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
