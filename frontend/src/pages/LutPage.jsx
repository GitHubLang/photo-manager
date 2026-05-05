import React, { useState, useRef } from 'react';
import { Upload, Button, Image, Space, Card, Divider, Typography, message, Spin } from 'antd';
import { InboxOutlined, SwapOutlined, DownloadOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { Title, Text } = Typography;
const API = window.location.protocol + '//' + window.location.hostname + ':8000/api/lut';

export default function LutPage() {
  const [sourceFile, setSourceFile] = useState(null);
  const [refFile, setRefFile] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [lutUrl, setLutUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const handleUpload = (file, setFile, setPreview) => {
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    return false; // prevent auto upload
  };

  const handleTransfer = async () => {
    if (!sourceFile || !refFile) {
      message.warning('请先上传原图和参考图');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('source', sourceFile);
      form.append('reference', refFile);
      const r = await fetch(API + '/transfer', { method: 'POST', body: form });
      if (!r.ok) throw new Error('Transfer failed');
      const data = await r.json();
      setResultUrl(API + '/output/' + data.url.split('/').pop());
      message.success('色彩迁移完成');
    } catch (e) {
      message.error('迁移失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractLut = async () => {
    if (!sourceFile || !resultUrl) {
      message.warning('请先完成色彩迁移');
      return;
    }
    setExtracting(true);
    try {
      // 下载结果图作为 styled
      const styledBlob = await fetch(resultUrl).then(r => r.blob());

      const form = new FormData();
      form.append('source', sourceFile);
      form.append('styled', new File([styledBlob], 'styled.jpg', { type: 'image/jpeg' }));
      const r = await fetch(API + '/extract', { method: 'POST', body: form });
      if (!r.ok) throw new Error('Extract failed');
      const data = await r.json();
      setLutUrl(API + '/download/' + data.url.split('/').pop());
      message.success('LUT 提取完成');
    } catch (e) {
      message.error('提取失败: ' + e.message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>LUT 克隆</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        上传参考风格图 + 原图 → 自动迁移色调 → 生成 .cube LUT 文件（可用于 Lightroom/PS）
      </Text>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title="原图（待调色）" size="small">
          <Dragger
            accept="image/*"
            maxCount={1}
            beforeUpload={(f) => handleUpload(f, setSourceFile, setSourcePreview)}
            showUploadList={false}
          >
            {sourcePreview ? (
              <Image src={sourcePreview} preview={false} style={{ maxHeight: 180, objectFit: 'contain' }} />
            ) : (
              <div>
                <InboxOutlined style={{ fontSize: 32, color: '#999' }} />
                <p>点击或拖拽上传</p>
              </div>
            )}
          </Dragger>
        </Card>

        <Card title="参考风格图" size="small">
          <Dragger
            accept="image/*"
            maxCount={1}
            beforeUpload={(f) => handleUpload(f, setRefFile, setRefPreview)}
            showUploadList={false}
          >
            {refPreview ? (
              <Image src={refPreview} preview={false} style={{ maxHeight: 180, objectFit: 'contain' }} />
            ) : (
              <div>
                <InboxOutlined style={{ fontSize: 32, color: '#999' }} />
                <p>点击或拖拽上传</p>
              </div>
            )}
          </Dragger>
        </Card>
      </div>

      <Space style={{ marginBottom: 24 }}>
        <Button type="primary" icon={<SwapOutlined />} onClick={handleTransfer}
          disabled={!sourceFile || !refFile} loading={loading}>
          风格迁移
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleExtractLut}
          disabled={!resultUrl} loading={extracting}>
          提取 .cube LUT
        </Button>
      </Space>

      {resultUrl && (
        <>
          <Divider />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <Card title="原图" size="small" cover={sourcePreview ? <Image src={sourcePreview} /> : null} />
            <Card title="风格迁移结果" size="small" cover={<Image src={resultUrl} />} />
            <Card title="参考风格" size="small" cover={refPreview ? <Image src={refPreview} /> : null} />
          </div>
        </>
      )}

      {lutUrl && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" size="large" icon={<DownloadOutlined />}
            onClick={() => window.open(lutUrl)}>
            下载 .cube LUT 文件
          </Button>
          <br />
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            导入 Lightroom/PS/DaVinci 即可使用
          </Text>
        </div>
      )}
    </div>
  );
}
