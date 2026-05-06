import React, { useState, useEffect } from 'react';
import { Select, Button, message, Typography, Divider } from 'antd';
const { Text, Title } = Typography;
import { fetchModels } from '../api/imageApi';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';

function getStored(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function setStored(key, val) {
  try { localStorage.setItem(key, val); } catch {} 
}

export default function GeneralPage() {
  const [models, setModels] = useState([]);
  const [scoringModel, setScoringModel] = useState(getStored(LS_SCORING));
  const [captionModel, setCaptionModel] = useState(getStored(LS_CAPTION));

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

  return (
    <div style={{ padding: 24, maxWidth: 960, width: '100%', margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>通用设置</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        默认模型等全局配置
      </Text>
      <div style={{ maxWidth: 500 }}>
        <Text strong>默认模型设置</Text>
        <Divider />
        <div style={{ marginBottom: 16 }}>
          <Text>评分模型：</Text>
          <Select
            value={scoringModel}
            onChange={setScoringModel}
            options={modelOptions}
            style={{ width: '100%', marginTop: 8 }}
            placeholder="选择评分使用的模型"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>文案模型：</Text>
          <Select
            value={captionModel}
            onChange={setCaptionModel}
            options={modelOptions}
            style={{ width: '100%', marginTop: 8 }}
            placeholder="选择文案生成使用的模型"
          />
        </div>
        <Button type="primary" onClick={handleSave}>保存设置</Button>
      </div>
    </div>
  );
}
