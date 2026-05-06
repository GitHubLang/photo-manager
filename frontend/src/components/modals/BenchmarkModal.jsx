import React, { useState, useEffect } from 'react';
import { Modal, Checkbox, Button, Card, Row, Col, message, Spin, Tag, Typography, Divider, Statistic, Space } from 'antd';
const { Text, Title } = Typography;
import { getProxyUrl, getThumbnailUrl } from '../../api/imageApi';

const API = window.location.protocol + '//' + window.location.hostname + ':8000/api';

const SCHEME_CONFIG = {
  opencv: { label: 'OpenCV 技术检测', color: 'blue', desc: '清晰度/曝光/对比度 本地毫秒级' },
  clip:   { label: 'CLIP+MLP 美学评分', color: 'purple', desc: '语义理解 1-10分 ~3秒' },
  musiq:  { label: 'MUSIQ 质量评分', color: 'green', desc: 'Transformer 精度最高 ~5秒' },
  llm:    { label: '大模型评分', color: 'orange', desc: '当前配置的 AI 模型评分' },
};

export default function BenchmarkModal({ visible, image, onClose }) {
  const [selected, setSelected] = useState(Object.keys(SCHEME_CONFIG));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [schemes, setSchemes] = useState(null);

  // 加载可用方案
  useEffect(() => {
    if (visible) {
      fetch(API + '/benchmark/schemes')
        .then(r => r.json())
        .then(data => setSchemes(data.schemes))
        .catch(() => {});
      setResults(null);
    }
  }, [visible]);

  const handleRun = async () => {
    if (!image) return;
    if (selected.length === 0) return message.warning('请至少勾选一个评分方案');
    setLoading(true);
    setResults(null);
    try {
      const r = await fetch(API + '/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: image.file_path,
          schemes: selected,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || '请求失败');
      setResults(data.results);
    } catch (e) {
      message.error('评分测试失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#1890ff';
    if (score >= 40) return '#faad14';
    return '#f5222d';
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={860}
      title="📊 评分方案对比测试"
      destroyOnClose
    >
      {image && (
        <div style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col>
              <img
                src={getThumbnailUrl(image.file_path, 200)}
                alt={image.filename}
                style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }}
              />
            </Col>
            <Col flex="auto">
              <Text strong>{image.filename}</Text>
              <br />
              <Text type="secondary">{image.width}x{image.height}</Text>
            </Col>
          </Row>
        </div>
      )}

      <Divider style={{ margin: '12px 0' }} />

      {/* 方案选择 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>选择评分方案</Text>
        <Checkbox.Group
          value={selected}
          onChange={setSelected}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
        >
          {Object.entries(SCHEME_CONFIG).map(([key, cfg]) => (
            <Checkbox key={key} value={key} style={{ lineHeight: '32px' }}>
              <Tag color={cfg.color}>{cfg.label}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>{cfg.desc}</Text>
            </Checkbox>
          ))}
        </Checkbox.Group>
      </div>

      <Button type="primary" size="large" onClick={handleRun} loading={loading} disabled={selected.length === 0}
        style={{ marginBottom: 20 }}>
        {loading ? '评分中...' : '🚀 开始对比测试'}
      </Button>

      {/* 结果展示 */}
      {results && (
        <div>
          <Divider style={{ margin: '8px 0' }} />
          <Title level={5}>📈 测试结果</Title>
          <Row gutter={[12, 12]}>
            {Object.entries(results).map(([key, result]) => (
              <Col xs={24} sm={12} key={key}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <Tag color={SCHEME_CONFIG[key]?.color || 'default'}>
                        {result.label || SCHEME_CONFIG[key]?.label || key}
                      </Tag>
                    </Space>
                  }
                  extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ⏱ {result.time}s
                    </Text>
                  }
                >
                  {result.error ? (
                    <Text type="danger">{result.error}</Text>
                  ) : (
                    <>
                      <Statistic
                        value={result.score}
                        precision={result.score % 1 === 0 ? 0 : 1}
                        suffix="分"
                        valueStyle={{ color: getScoreColor(result.score) }}
                      />
                      {result.details && typeof result.details === 'object' && (
                        <div style={{ marginTop: 8 }}>
                          {Object.entries(result.details).map(([k, v]) => (
                            <div key={k} style={{ fontSize: 12, color: '#666' }}>
                              {k}: {v}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Modal>
  );
}
