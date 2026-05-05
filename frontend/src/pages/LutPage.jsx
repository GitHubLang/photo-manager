import React, { useState, useRef } from 'react';
import { Upload, Button, Image, Space, Card, Divider, Typography, message, Spin } from 'antd';
import { InboxOutlined, SwapOutlined, DownloadOutlined, CopyOutlined, EyeOutlined, ExportOutlined } from '@ant-design/icons';

const { Dragger } = Upload;
const { Title, Text } = Typography;
const API = window.location.protocol + '//' + window.location.hostname + ':8000/api/lut';

const AI_PROMPT = `任务目标
请将【待处理图片】调整为【参考图片】的整体颜色风格。这是"全局 LUT / 全局滤镜模拟"任务，不是修图、不是重绘、不是美化。

严格规则
1、只允许进行全局调色，效果必须像给整张图片直接套用了同一个 LUT。
2、不允许使用蒙版、局部调整、局部提亮、局部降饱和、局部换色、局部肤色修正。
3、不允许重绘、修脸、磨皮、美颜、补光、加雾、柔焦、锐化、降噪、HDR、暗角、颗粒、光晕、景深、背景替换。
4、不允许改变人物五官、嘴唇、皮肤纹理、头发、衣服、草地、天空、建筑、物体边缘和画面细节。
5、不允许裁剪、旋转、透视变形、拉伸、缩放构图、改变画幅比例。
6、输出图片必须与上传的待处理图片保持完全相同的分辨率、宽高比例和构图。
7、如果上传图片是 1920×1080，输出也必须是 1920×1080；如果上传图片是其他尺寸，也必须原尺寸输出。
8、不要为了适配参考图而裁剪或补边，不要改变任何像素位置对应的内容。

颜色模仿要求
1、自动分析参考图片的全局色彩风格，包括白平衡、色温、色调、曝光、对比度、黑位、白位、阴影、高光、饱和度、色相倾向、色彩分离、明暗层次。
2、将这些"全局调色规律"迁移到待处理图片上。
3、保持不同颜色类别的相对关系，不要把绿色草地错误变成黄色、橙色或灰色。
4、草地如果参考图是浅绿色，就调整为浅绿色；如果参考图是黄绿色，才允许偏黄绿色。
5、天空、草地、肤色、红色嘴唇、白色衣服、黑色头发等颜色都必须按照参考图的整体色彩倾向自然迁移，不要单独重绘。
6、保留原图的纹理、边缘、清晰度和光影结构，只改变颜色和整体明暗。
7、最终效果应该像"原图直接套用了参考图同款滤镜"，而不是重新生成了一张图片。

输出要求
如果某个效果无法通过全局调色完成，请不要进行局部修改或重绘，只用全局调色近似。

请只输出调色后的图片，不要输出解释文字。重要：输出画布必须和待处理图片完全一致。不得裁剪，不得扩图，不得补边，不得改变画幅，不得改变人物或物体位置。输出宽度、高度、构图、透视、边缘内容必须与待处理图片逐像素对应。只改变颜色，不改变内容。`;

export default function LutPage() {
  const [sourceFile, setSourceFile] = useState(null);
  const [refFile, setRefFile] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [resultUrl, setResultUrl] = useState(null);
  const [lutUrl, setLutUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [testFile, setTestFile] = useState(null);
  const [testPreview, setTestPreview] = useState(null);
  const [prevResultUrl, setPrevResultUrl] = useState(null);
  const [previewing, setPreviewing] = useState(false);

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

  const handlePreview = async () => {
    if (!lutUrl || !testFile) {
      message.warning('请先提取 LUT 并上传测试图');
      return;
    }
    setPreviewing(true);
    try {
      const lutBlob = await fetch(lutUrl).then(r => r.blob());
      const form = new FormData();
      form.append('lut', new File([lutBlob], 'test.cube'));
      form.append('test_image', testFile);
      const r = await fetch(API + '/preview', { method: 'POST', body: form });
      if (!r.ok) throw new Error('Preview failed');
      const data = await r.json();
      setPrevResultUrl(API + '/output/' + data.url.split('/').pop());
      message.success('预览生成完成');
    } catch (e) {
      message.error('预览失败: ' + e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleExport = () => {
    if (prevResultUrl) {
      const a = document.createElement('a');
      a.href = prevResultUrl;
      a.download = 'preview_result.jpg';
      a.click();
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <Title level={3}>LUT 克隆</Title>
      <div style={{ marginBottom: 24 }}>
        <Text type="secondary">
          上传参考风格图 + 原图 → 自动迁移色调 → 生成 .cube LUT 文件（可用于 Lightroom/PS）
        </Text>
        <Button
          type="primary"
          size="small"
          icon={<CopyOutlined />}
          style={{ marginLeft: 12 }}
          onClick={() => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(AI_PROMPT).then(() => message.success('AI 提示词已复制')).catch(() => fallbackCopy());
            } else {
              fallbackCopy();
            }
            function fallbackCopy() {
              const ta = document.createElement('textarea');
              ta.value = AI_PROMPT;
              ta.style.position = 'fixed'; ta.style.left = '-9999px';
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              message.success('AI 提示词已复制');
            }
          }}
        >
          复制 AI 提示词
        </Button>
        <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 6, maxHeight: 200, overflow: 'auto', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {AI_PROMPT}
        </div>
      </div>

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
        <>
          <Divider />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card title="测试预览" size="small">
              <Dragger
                accept="image/*"
                maxCount={1}
                beforeUpload={(f) => { handleUpload(f, setTestFile, setTestPreview); return false; }}
                showUploadList={false}
              >
                {testPreview ? (
                  <Image src={testPreview} preview={false} style={{ maxHeight: 120, objectFit: 'contain' }} />
                ) : (
                  <div>
                    <InboxOutlined style={{ fontSize: 24, color: '#999' }} />
                    <p style={{ fontSize: 12 }}>上传测试图</p>
                  </div>
                )}
              </Dragger>
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={handlePreview}
                    disabled={!testFile} loading={previewing}>
                    预览
                  </Button>
                  <Button size="small" icon={<ExportOutlined />} onClick={handleExport}
                    disabled={!prevResultUrl}>
                    导出
                  </Button>
                </Space>
              </div>
            </Card>
            <Card title="预览结果" size="small">
              {prevResultUrl ? (
                <Image src={prevResultUrl} />
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  上传测试图后点击预览
                </div>
              )}
            </Card>
          </div>
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
        </>
      )}
    </div>
  );
}
