import React, { useState, useEffect } from 'react';
import { Select, Button, message, Typography, Divider, Spin, Input } from 'antd';
const { Text } = Typography;
import { fetchModels, fetchSettings, saveSettings } from '../../api/imageApi';

const LS_SCORING = 'pm_scoring_model_id';
const LS_CAPTION = 'pm_caption_model_id';
const LS_COLLECTION_LLM = 'pm_collection_llm_model';

function getLocal(key) { try { return localStorage.getItem(key) || ''; } catch { return ''; } }

/**
 * GeneralSettings — 通用设置组件
 * 评分/文案/合集模型选择 + BGM 目录配置
 */
export default function GeneralSettings() {
  const [models, setModels] = useState([]);
  const [scoringModel, setScoringModel] = useState(getLocal(LS_SCORING));
  const [captionModel, setCaptionModel] = useState(getLocal(LS_CAPTION));
  const [collectionLlmModel, setCollectionLlmModel] = useState(getLocal(LS_COLLECTION_LLM));
  const [bgmLocalDir, setBgmLocalDir] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchModels().then(d => setModels(d.models || [])).catch(() => {}),
      fetchSettings().then(data => {
        if (data.scoring_model) { setScoringModel(data.scoring_model); try { localStorage.setItem(LS_SCORING, data.scoring_model); } catch {} }
        if (data.caption_model) { setCaptionModel(data.caption_model); try { localStorage.setItem(LS_CAPTION, data.caption_model); } catch {} }
        if (data.caption_llm_model) { setCollectionLlmModel(data.caption_llm_model); try { localStorage.setItem(LS_COLLECTION_LLM, data.caption_llm_model); } catch {} }
        if (data.bgm_local_dir !== undefined) setBgmLocalDir(data.bgm_local_dir);
      }).catch(() => {
        setScoringModel(getLocal(LS_SCORING));
        setCaptionModel(getLocal(LS_CAPTION));
        setCollectionLlmModel(getLocal(LS_COLLECTION_LLM));
      }),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try { await saveSettings({ scoring_model: scoringModel, caption_model: captionModel, caption_llm_model: collectionLlmModel, bgm_local_dir: bgmLocalDir }); } catch {}
    try { localStorage.setItem(LS_SCORING, scoringModel); localStorage.setItem(LS_CAPTION, captionModel); localStorage.setItem(LS_COLLECTION_LLM, collectionLlmModel); } catch {}
    message.success('设置已保存');
  };

  const modelOptions = models.map(m => ({ value: m.name, label: m.name }));

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 500 }}>
        <Text strong>默认模型设置</Text>
        <Divider />
        <div style={{ marginBottom: 16 }}>
          <Text>评分模型：</Text>
          <Select value={scoringModel || undefined} onChange={setScoringModel}
            options={modelOptions} style={{ width: '100%', marginTop: 8 }}
            placeholder="选择评分使用的模型" allowClear />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>文案模型：</Text>
          <Select value={captionModel || undefined} onChange={setCaptionModel}
            options={modelOptions} style={{ width: '100%', marginTop: 8 }}
            placeholder="选择文案生成使用的模型" allowClear />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text>合集文案模型：</Text>
          <Select value={collectionLlmModel || undefined} onChange={setCollectionLlmModel}
            options={modelOptions} style={{ width: '100%', marginTop: 8 }}
            placeholder="选择合集标题/文案生成使用的模型" allowClear />
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
            用于照片合集的标题、文案和标签自动生成
          </Text>
        </div>
        <Button type="primary" onClick={handleSave}>保存设置</Button>
      </div>

      <Divider />
      <div style={{ maxWidth: 500 }}>
        <Text strong>背景音乐设置</Text>
        <Divider />
        <div style={{ marginBottom: 16 }}>
          <Text>本地音乐目录（可选）：</Text>
          <Input value={bgmLocalDir} onChange={e => setBgmLocalDir(e.target.value)}
            placeholder="例如：D:\Music\bgm" style={{ width: '100%', marginTop: 8 }} />
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
            照片合集背景音乐优先从这里读取。留空则使用预置曲库。支持 mp3, wav, ogg, flac, m4a
          </Text>
        </div>
        <Button type="primary" onClick={handleSave}>保存设置</Button>
      </div>
    </Spin>
  );
}
