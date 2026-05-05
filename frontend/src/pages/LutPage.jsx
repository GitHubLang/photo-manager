import React, { useState } from 'react';
import { Upload, Button, Image, message, Typography } from 'antd';
import { InboxOutlined, DownloadOutlined, CopyOutlined, EyeOutlined, ArrowRightOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
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

const C = {
  box: { padding: 24, maxWidth: 960, margin: '0 auto' },
  step: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 },
  stepNum: { width: 28, height: 28, borderRadius: '50%', background: '#1677ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  uploadBox: (hasFile) => ({
    border: `2px dashed ${hasFile ? '#1677ff' : '#e0e0e0'}`,
    borderRadius: 10, padding: hasFile ? 8 : 32, textAlign: 'center', cursor: 'pointer',
    transition: 'border-color .3s', background: hasFile ? '#f6f9ff' : '#fafafa',
    minHeight: 160, display: 'flex', alignItems: 'center', justifyContent: 'center'
  }),
  btn: { borderRadius: 6, height: 38 },
};

export default function LutPage() {
  const [sourceFile, setSourceFile] = useState(null);
  const [styledFile, setStyledFile] = useState(null);
  const [sourcePreview, setSourcePreview] = useState(null);
  const [styledPreview, setStyledPreview] = useState(null);
  const [lutUrl, setLutUrl] = useState(null);
  const [extracting, setExtracting] = useState(false);

  const [testFile, setTestFile] = useState(null);
  const [testPreview, setTestPreview] = useState(null);
  const [prevResultUrl, setPrevResultUrl] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [showPrompt, setShowPrompt] = useState(true);

  const handleUpload = (file, setFile, setPreview) => {
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
    return false;
  };

  const handleExtractLut = async () => {
    if (!sourceFile || !styledFile) return message.warning('请上传原图和AI生成的目标图');
    setExtracting(true);
    try {
      const form = new FormData();
      form.append('source', sourceFile);
      form.append('styled', styledFile);
      const r = await fetch(API + '/extract', { method: 'POST', body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Extract failed');
      setLutUrl(API + '/download/' + data.url.split('/').pop());
      message.success('LUT 提取完成');
    } catch (e) { message.error('提取失败: ' + e.message); }
    finally { setExtracting(false); }
  };

  const handlePreview = async () => {
    if (!lutUrl || !testFile) return message.warning('请先提取 LUT 并上传测试图');
    setPreviewing(true);
    try {
      const [lutBlob] = await Promise.all([fetch(lutUrl).then(r => r.blob())]);
      const form = new FormData();
      form.append('lut', new File([lutBlob], 'test.cube'));
      form.append('test_image', testFile);
      const r = await fetch(API + '/preview', { method: 'POST', body: form });
      const data = await r.json();
      setPrevResultUrl(API + '/output/' + data.url.split('/').pop());
      setSliderPos(50);
    } catch (e) { message.error('预览失败: ' + e.message); }
    finally { setPreviewing(false); }
  };

  const copyPrompt = () => {
    const ta = document.createElement('textarea');
    ta.value = AI_PROMPT;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    message.success('已复制，去 ChatGPT/MiniMax 粘贴');
  };

  return (
    <div style={C.box}>
      <Title level={3} style={{ marginBottom: 4, fontWeight: 600 }}>LUT 克隆</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 28 }}>
        从原图 + AI 生成的目标图中提取 .cube 色彩查找表，可用于 Lightroom / PS / DaVinci
      </Text>

      {/* Step 1 */}
      <div style={C.step}>
        <span style={C.stepNum}>1</span>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 15 }}>AI 生成风格图</Text>
          <br /><Text type="secondary">用提示词让 AI 把原图变成目标风格</Text>
        </div>
        <Button icon={<CopyOutlined />} onClick={copyPrompt} style={C.btn}>复制提示词</Button>
        <Button type="text" size="small" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? '收起' : '展开'}提示词</Button>
      </div>
      {showPrompt && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f8f9fa', borderRadius: 8, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto', color: '#555' }}>
          {AI_PROMPT}
        </div>
      )}

      {/* Step 2 */}
      <div style={C.step}>
        <span style={C.stepNum}>2</span>
        <div style={{ flex: 1 }}>
          <Text strong style={{ fontSize: 15 }}>上传原图 + 目标图</Text>
        </div>
        <Button type="primary" size="large" icon={<DownloadOutlined />}
          disabled={!sourceFile || !styledFile} loading={extracting} onClick={handleExtractLut}
          style={{ ...C.btn, height: 42, padding: '0 28px' }}>
          提取 LUT
        </Button>
      </div>

      <div style={{ ...C.grid2, marginBottom: 32 }}>
        {/* 原图 */}
        <div>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>原图</Text>
          <div style={C.uploadBox(!!sourcePreview)} onClick={() => document.getElementById('lut-source-input').click()}>
            {sourcePreview ? (
              <img src={sourcePreview} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6 }} alt="" />
            ) : (
              <div><InboxOutlined style={{ fontSize: 36, color: '#bbb' }} /><p style={{ marginTop: 8, color: '#999', fontSize: 13 }}>点击上传原图</p></div>
            )}
          </div>
          <input id="lut-source-input" type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], setSourceFile, setSourcePreview)} />
        </div>

        {/* 目标图 */}
        <div>
          <Text type="secondary" style={{ marginBottom: 8, display: 'block', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>AI 生成的目标图</Text>
          <div style={C.uploadBox(!!styledPreview)} onClick={() => document.getElementById('lut-styled-input').click()}>
            {styledPreview ? (
              <img src={styledPreview} style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6 }} alt="" />
            ) : (
              <div><InboxOutlined style={{ fontSize: 36, color: '#bbb' }} /><ArrowRightOutlined style={{ fontSize: 18, color: '#1677ff', margin: '0 4px' }} /><p style={{ marginTop: 8, color: '#999', fontSize: 13 }}>点击上传目标图</p></div>
            )}
          </div>
          <input id="lut-styled-input" type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], setStyledFile, setStyledPreview)} />
        </div>
      </div>

      {/* LUT 下载 */}
      {lutUrl && (
        <div style={{ textAlign: 'center', marginBottom: 32, padding: 16, background: '#f0f5ff', borderRadius: 10 }}>
          <Text style={{ marginRight: 12 }}>LUT 提取完成</Text>
          <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.open(lutUrl)}>下载 .cube 文件</Button>
          <Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>可导入 Lightroom / Photoshop / DaVinci</Text>
        </div>
      )}

      {/* Step 3 — 预览对比 */}
      <div style={{ background: '#fafafa', borderRadius: 12, padding: 24 }}>
        <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 4 }}>预览对比</Text>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>上传测试图，拖动中间竖线对比原图与 LUT 效果</Text>

        <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
          <div style={{ flex: 1, ...C.uploadBox(!!testPreview) }} onClick={() => document.getElementById('lut-test-input').click()} >
            {testPreview ? (
              <img src={testPreview} style={{ width: '100%', maxHeight: 80, objectFit: 'contain', borderRadius: 4 }} alt="" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                <InboxOutlined style={{ fontSize: 20, color: '#bbb' }} />
                <span style={{ color: '#999', fontSize: 13 }}>上传测试图</span>
              </div>
            )}
          </div>
          <Button type="primary" icon={<EyeOutlined />} onClick={handlePreview} disabled={!testFile} loading={previewing} style={C.btn}>
            生成预览
          </Button>
          <input id="lut-test-input" type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0], setTestFile, setTestPreview)} />
        </div>

        {/* 滑块对比 */}
        {prevResultUrl && testPreview && (
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.1)', userSelect: 'none', cursor: 'ew-resize' }}>
            <img src={testPreview} alt="原图" style={{ width: '100%', display: 'block' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: sliderPos + '%', height: '100%', overflow: 'hidden', borderRight: '2px solid #fff' }}>
              <img src={prevResultUrl} alt="LUT效果" style={{ width: (10000 / Math.max(sliderPos, 1)) + '%', maxWidth: 'none', display: 'block' }} />
            </div>
            <div style={{ position: 'absolute', left: sliderPos + '%', top: 0, bottom: 0, width: 3, background: '#fff', boxShadow: '0 0 0 1px rgba(0,0,0,.15)', zIndex: 5 }} />
            <div
              style={{
                position: 'absolute', left: `calc(${sliderPos}% - 18px)`, top: '50%', transform: 'translateY(-50%)',
                width: 36, height: 36, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
              }}
              onMouseDown={(e) => {
                const container = e.currentTarget.parentElement;
                const rect = container.getBoundingClientRect();
                const onMove = (ev) => {
                  const x = ev.clientX - rect.left;
                  setSliderPos(Math.min(100, Math.max(0, (x / rect.width) * 100)));
                };
                const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#888"><path d="M8 5l-7 7 7 7M16 5l7 7-7 7"/></svg>
            </div>
            <span style={{ position: 'absolute', bottom: 10, left: 14, background: 'rgba(0,0,0,.55)', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, pointerEvents: 'none' }}>原图</span>
            <span style={{ position: 'absolute', bottom: 10, right: 14, background: 'rgba(0,0,0,.55)', color: '#fff', padding: '2px 10px', borderRadius: 4, fontSize: 11, pointerEvents: 'none' }}>LUT</span>
          </div>
        )}
      </div>
    </div>
  );
}
