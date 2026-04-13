import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Tag } from 'antd';
import { fetchInstructionHistory, saveInstructionHistory } from '../../api/imageApi';

export default function CaptionInstructionsModal({ open, captionType, onCancel, onGenerate }) {
  const [instructions, setInstructions] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingHistory(true);
    fetchInstructionHistory(captionType)
      .then(data => { setHistory(data.history || []); setLoadingHistory(false); })
      .catch(() => setLoadingHistory(false));
  }, [open, captionType]);

  const handleOk = () => {
    const text = instructions.trim();
    if (text) {
      saveInstructionHistory(text, captionType);
    }
    onGenerate(text);
    setInstructions('');
  };

  const handleCancel = () => {
    setInstructions('');
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={'生成' + (captionType === 'douyin' ? '抖音' : '小红书') + '文案 - 添加自定义要求'}
      okText="生成"
      cancelText="取消"
      onOk={handleOk}
      width={500}
      centered
    >
      <p style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
        {captionType === 'douyin' ? '抖音' : '小红书'}文案 - 可选填写自定义要求
      </p>
      <Select
        placeholder="从历史记录中选择，或直接填写"
        allowClear
        showSearch
        listHeight={500}
        filterOption={(input, option) =>
          option.children.props.children[1]?.props?.children?.toLowerCase().includes(input.toLowerCase())
        }
        loading={loadingHistory}
        style={{ width: '100%', marginBottom: 8 }}
        onChange={(val) => setInstructions(val || '')}
        dropdownStyle={{ maxHeight: 'none' }}
      >
        {history.map(item => (
          <Select.Option key={item.id} value={item.instruction}>
            <div style={{ padding: '2px 0', wordBreak: 'break-all' }}>
              <Tag color={item.set_type === 'douyin' ? 'blue' : 'green'} style={{ marginRight: 6 }}>
                {item.set_type === 'douyin' ? '抖音' : '小红书'}
              </Tag>
              {item.instruction}
            </div>
          </Select.Option>
        ))}
      </Select>
      <Input.TextArea
        rows={3}
        value={instructions}
        onChange={e => setInstructions(e.target.value)}
        placeholder="例如：接地气口语化 / 文艺小清新风格 / 突出摄影技术 / 不要emoji"
      />
    </Modal>
  );
}
