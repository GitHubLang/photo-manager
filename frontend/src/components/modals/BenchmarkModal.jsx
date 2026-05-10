import React, { useState, useEffect } from 'react';
import { Modal, Checkbox, Button, Card, Row, Col, message, Spin, Tag, Typography, Divider, Statistic, Space, Tooltip, Collapse } from 'antd';
const { Text, Title } = Typography;
import { InfoCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { getThumbnailUrl } from '../../api/imageApi';

const API = window.location.protocol + '//' + window.location.hostname + ':8000/api';

const SCHEME_CONFIG = {
  opencv: { label: 'OpenCV 技术检测', color: 'blue', desc: '清晰度/曝光/对比度 本地毫秒级' },
  clip:   { label: 'CLIP+MLP 美学评分', color: 'purple', desc: '语义理解 1-10分 ~3秒' },
  musiq:  { label: 'MUSIQ 质量评分', color: 'green', desc: 'Transformer 精度最高 ~5秒' },
  llm:    { label: '大模型评分', color: 'orange', desc: '当前配置的 AI 模型评分' },
};

const OPENCV_TABLE = {
  title: 'OpenCV 技术检测 — 各维度评分规则',
  total: '总分 = 曝光×50% + 对比度×50%（清晰度仅作参考不计入）',
  cols: ['维度', '范围', '不及格（<30）', '及格（30-60）', '良好（60-80）', '优秀（>80）'],
  rows: [
    ['清晰度', 'Laplacian方差', '较低', '', '', '较高'],
    ['曝光',   '0-100', '过曝/欠曝严重', '有点偏亮/偏暗', '曝光正常', '完美曝光'],
    ['对比度', '0-100', '灰蒙蒙', '层次不足', '对比适中', '层次丰富'],
  ],
};

const CLIP_TABLE = {
  title: 'CLIP+MLP 美学评分 — 评分规则',
  total: '评分范围 1-10',
  cols: ['维度', '范围', '较差（<4）', '一般（4-6）', '良好（6-8）', '优秀（>8）'],
  rows: [
    ['美学分', '1-10', '缺乏美感', '中规中矩', '美观', '非常出色'],
  ],
};

const MUSIQ_TABLE = {
  title: 'MUSIQ 质量评分 — 评分规则',
  total: '评分范围 0-100',
  cols: ['维度', '范围', '低质量（<40）', '一般（40-60）', '良好（60-80）', '优秀（>80）'],
  rows: [
    ['质量分', '0-100', '明显缺陷', '可用', '高质量', '顶级画质'],
  ],
};

const LLM_TABLE = {
  title: '大模型评分 — 评分规则',
  total: '评分范围 0-100',
  cols: ['维度', '范围', '差片（<40）', '一般（40-60）', '好片（60-80）', '佳作（>80）'],
  rows: [
    ['综合分', '0-100', '技术和内容双差', '普通', '不错', '精选级'],
  ],
};

const TABLE_MAP = { opencv: OPENCV_TABLE, clip: CLIP_TABLE, musiq: MUSIQ_TABLE, llm: LLM_TABLE };

const SCORE_LEVELS = [
  { range: '≥80', label: '优秀', color: '#52c41a' },
  { range: '60-79', label: '良好', color: '#1890ff' },
  { range: '40-59', label: '及格', color: '#faad14' },
  { range: '<40', label: '不及格', color: '#f5222d' },
];

export default function BenchmarkModal({ visible, image, onClose }) {
  const [selected, setSelected] = useState(Object.keys(SCHEME_CONFIG));
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) setResults(null);
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
      title="评分方案对比测试"
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
        {loading ? '评分中...' : '开始对比测试'}
      </Button>

      {/* 评价标准指南（可折叠） */}
      <Collapse
        ghost
        style={{ marginBottom: 12 }}
        items={[{
          key: 'standards',
          label: (
            <Space size={4}>
              <QuestionCircleOutlined style={{ color: '#1677ff' }} />
              <Text type="secondary" style={{ fontSize: 13 }}>评价标准说明</Text>
            </Space>
          ),
          children: (
            <div style={{ padding: '4px 0' }}>
              {/* 通用等级 */}
              <div style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: 600 }}>通用等级</Text>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  {SCORE_LEVELS.map(lv => (
                    <Tag key={lv.range} color={lv.color}>{lv.range}分 {lv.label}</Tag>
                  ))}
                </div>
              </div>
              {/* 各方案维度说明 — 表格 */}
              {selected.map(key => {
                const t = TABLE_MAP[key];
                if (!t) return null;
                return (
                  <div key={key} style={{ marginTop: 12 }}>
                    <Text style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</Text>
                    <div style={{ overflowX: 'auto', marginTop: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#fafafa' }}>
                            {t.cols.map((c, i) => (
                              <th key={i} style={{
                                border: '1px solid #e8e8e8',
                                padding: '6px 10px',
                                textAlign: 'left',
                                fontWeight: 600,
                                color: i === 0 ? '#333' : i <= 2 ? '#f5222d' : i <= 3 ? '#faad14' : '#52c41a',
                              }}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((row, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#fafafa' }}>
                              {row.map((cell, ci) => (
                                <td key={ci} style={{
                                  border: '1px solid #e8e8e8',
                                  padding: '5px 10px',
                                  fontWeight: ci === 0 ? 600 : 400,
                                }}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>{t.total}</Text>
                  </div>
                );
              })}
            </div>
          ),
        }]}
      />

      {/* 结果展示 */}
      {results && (
        <div>
          <Divider style={{ margin: '8px 0' }} />
          <Title level={5}>测试结果</Title>
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
                      <Tooltip title={`${SCHEME_CONFIG[key]?.label}评分标准`}>
                        <InfoCircleOutlined style={{ color: '#999', cursor: 'help' }} />
                      </Tooltip>
                    </Space>
                  }
                  extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {result.time}s
                    </Text>
                  }
                >
                  {result.error ? (
                    <Text type="danger">{result.error}</Text>
                  ) : result.score === null ? (
                    /* 无总分方案（如 OpenCV）：只展示各维度 */
                    <div>
                      {result.details && typeof result.details === 'object' && Object.entries(result.details).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{k}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color: getScoreColor(v) }}>{v}</div>
                          <div style={{ fontSize: 11, color: '#999' }}>越高越好 (0-100)</div>
                        </div>
                      ))}
                    </div>
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
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666', borderBottom: '1px solid #f0f0f0', padding: '2px 0' }}>
                              <span>{k}</span>
                              <span style={{ fontWeight: 500, color: getScoreColor(v) }}>{v}</span>
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
