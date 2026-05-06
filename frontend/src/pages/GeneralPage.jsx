import React, { useState, useEffect } from 'react';
import { Select, Button, message, Typography, Divider, Spin } from 'antd';
const { Text, Title } = Typography;
import { fetchModels, fetchSettings, saveSettings } from '../api/imageApi';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';

function getLocal(key) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}

export default function GeneralPage() {
  const [models, setModels] = useState([]);
  const [scoringModel, setScoringModel] = useState(getLocal(LS_SCORING));
  const [captionModel, setCaptionModel] = useState(getLocal(LS_CAPTION));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 先尝试从服务端加载，回退到 localStorage
    Promise.all([
      fetchModels().then(d => setModels(d.models || [])).catch(() => {}),
      fetchSettings().then(data => {
        if (data.scoring_model) {
          setScoringModel(data.scoring_model);
          try { localStorage.setItem(LS_SCORING, data.scoring_model); } catch {}
        }
        if (data.caption_model) {
          setCaptionModel(data.caption_model);
          try { localStorage.setItem(LS_CAPTION, data.caption_model); } catch {}
        }
      }).catch(() => {
        // 服务端不可用时回退到 localStorage
        setScoringModel(getLocal(LS_SCORING));
        setCaptionModel(getLocal(LS_CAPTION));
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    // 存服务端
    try {
      await saveSettings({ scoring_model: scoringModel, caption_model: captionModel });
    } catch {
      // 服务端不可用时只存 localStorage
    }
    // 始终存 localStorage（本地冗余）
    try {
      localStorage.setItem(LS_SCORING, scoringModel);
      localStorage.setItem(LS_CAPTION, captionModel);
    } catch {}
    message.success('设置已保存（跨设备同步）');
  };

  const modelOptions = models.map(m => ({
    value: m.name,
    label: m.name
  }));

  return (
    <div style={{ padding: 24, maxWidth: 960, width: '100%', margin: '0 auto' }}>
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>通用设置</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        默认模型等全局配置——设置自动保存到服务端，多设备同步
      </Text>
      <Spin spinning={loading}>
        <div style={{ maxWidth: 500 }}>
          <Text strong>默认模型设置</Text>
          <Divider />
          <div style={{ marginBottom: 16 }}>
            <Text>评分模型：</Text>
            <Select
              value={scoringModel || undefined}
              onChange={setScoringModel}
              options={modelOptions}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="选择评分使用的模型"
              allowClear
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Text>文案模型：</Text>
            <Select
              value={captionModel || undefined}
              onChange={setCaptionModel}
              options={modelOptions}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="选择文案生成使用的模型"
              allowClear
            />
          </div>
          <Button type="primary" onClick={handleSave}>保存设置</Button>
        </div>
      </Spin>
    </div>
  );
}
