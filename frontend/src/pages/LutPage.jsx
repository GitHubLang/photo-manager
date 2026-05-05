import React, { useState, useRef } from 'react';
import { Upload, Button, Image, Space, Card, Divider, Typography, message } from 'antd';
import { InboxOutlined, DownloadOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';

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
  const [styledFile, setStyledFile] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [styledPreview, setStyledPreview] = useState(null);
  const [lutUrl, setLutUrl] = useState(null);
  const [extracting, setExtracting] = useState(false);

  // 预览
  const [testFile, setTestFile] = useState(null);
  const [testPreview, setTestPreview] = useState(null);
  const [prevResultUrl, setPrevResultUrl] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);

  const handleUpload = (file, setFile, setPreview) => {
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    return false;
  };

  const handleExtractLut = async () => {
    if (!sourceFile || !styledFile) {
      message.warning('请上传原图和AI生成的目标图');
      return;
    }
    setExtracting(true);
    try {
      const form = new FormData();
      form.append('source', sourceFile);
      form.append('styled', styledFile);
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
      setSliderPos(50);
      message.success('预览生成完成，拖动滑块对比');
    } catch (e) {
      message.error('预览失败: ' + e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const copyPrompt = () => {
    const ta = document.createElement('textarea');
    ta.value = AI_PROMPT;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    message.success('AI 提示词已复制，去 ChatGPT/MiniMax 粘贴使用');
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>LUT 克隆</Title>

      {/* 提示词区 */}
      <div style={{ marginBottom: 24, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text strong>步骤1：复制提示词 → AI 生成</Text>
          <Button type="primary" size="small" icon={<CopyOutlined />} onClick={copyPrompt}>复制 AI 提示词</Button>
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          去 ChatGPT/MiniMax 粘贴提示词 + 原图 + 参考图 → 获得 AI 生成的风格图
        </Text>
      </div>

      {/* 上传区 */}
      <div style={{ marginBottom: 24, padding: 16, background: '#fffbe6', borderRadius: 6 }}>
        <Text strong style={{ marginBottom: 12, display: 'block' }}>步骤2：上传原图 + AI生成的目标图</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card title="原图" size="small">
            <Dragger accept="image/*" maxCount={1}
              beforeUpload={(f) => handleUpload(f, setSourceFile, setSourcePreview)} showUploadList={false}>
              {sourcePreview ? (
                <Image src={sourcePreview} preview={false} style={{ maxHeight: 150, objectFit: 'contain' }} />
              ) : (
                <div><InboxOutlined style={{ fontSize: 24, color: '#999' }} /><p style={{ fontSize: 12 }}>原图</p></div>
              )}
            </Dragger>
          </Card>
          <Card title="AI 生成的目标图" size="small">
            <Dragger accept="image/*" maxCount={1}
              beforeUpload={(f) => handleUpload(f, setStyledFile, setStyledPreview)} showUploadList={false}>
              {styledPreview ? (
                <Image src={styledPreview} preview={false} style={{ maxHeight: 150, objectFit: 'contain' }} />
              ) : (
                <div><InboxOutlined style={{ fontSize: 24, color: '#999' }} /><p style={{ fontSize: 12 }}>AI 生成图</p></div>
              )}
            </Dragger>
          </Card>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" size="large" icon={<DownloadOutlined />}
            disabled={!sourceFile || !styledFile} loading={extracting} onClick={handleExtractLut}>
            提取 .cube LUT
          </Button>
        </div>
      </div>

      {/* 下载 LUT */}
      {lutUrl && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.open(lutUrl)}>
            下载 .cube LUT 文件
          </Button>
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>导入 Lightroom/PS/DaVinci</Text>
        </div>
      )}

      {/* 预览对比区 */}
      <Divider>预览对比</Divider>
      <div style={{ marginBottom: 16, padding: 12, background: '#f0f5ff', borderRadius: 6 }}>
        <Text strong style={{ marginBottom: 8, display: 'block' }}>上传测试图预览 LUT 效果</Text>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Dragger accept="image/*" maxCount={1} style={{ flex: 1 }}
            beforeUpload={(f) => { handleUpload(f, setTestFile, setTestPreview); return false; }} showUploadList={false}>
            {testPreview ? (
              <Image src={testPreview} preview={false} style={{ maxHeight: 60, objectFit: 'contain' }} />
            ) : (
              <div style={{ padding: '8px 0' }}><InboxOutlined style={{ fontSize: 18 }} /><p style={{ fontSize: 11, margin: 0 }}>测试图</p></div>
            )}
          </Dragger>
          <Button icon={<EyeOutlined />} onClick={handlePreview} disabled={!testFile} loading={previewing}>生成预览</Button>
        </div>
      </div>

      {/* 滑块对比 */}
      {prevResultUrl && testPreview && (
        <div style={{ position: 'relative', width: '100%', maxHeight: 500, overflow: 'hidden', borderRadius: 8, border: '1px solid #ddd', userSelect: 'none' }}>
          {/* 原图（底层） */}
          <img src={testPreview} alt="原图" style={{ width: '100%', display: 'block' }} />
          {/* LUT 结果（上层裁剪） */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: sliderPos + '%', height: '100%', overflow: 'hidden' }}>
            <img src={prevResultUrl} alt="LUT结果" style={{ width: (10000 / sliderPos) + '%', maxWidth: 'none', display: 'block' }} />
          </div>
          {/* 拖动条 */}
          <div
            style={{
              position: 'absolute', top: 0, left: sliderPos + '%', width: 3, height: '100%',
              background: '#fff', boxShadow: '0 0 8px rgba(0,0,0,0.3)', cursor: 'ew-resize', zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const container = e.target.parentElement;
              const onMove = (ev) => {
                const rect = container.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                setSliderPos(Math.min(100, Math.max(0, (x / rect.width) * 100)));
              };
              const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', background: '#fff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: '6px solid #666' }} />
              <div style={{ width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: '6px solid #666', marginLeft: 2 }} />
            </div>
          </div>
          {/* 标签 */}
          <div style={{ position: 'absolute', bottom: 8, left: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>原图</div>
          <div style={{ position: 'absolute', bottom: 8, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>LUT</div>
        </div>
      )}
    </div>
  );
}
