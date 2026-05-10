import React, { useState, useEffect, useCallback } from 'react';
import { Table, Button, Form, Input, Checkbox, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined, CopyOutlined } from '@ant-design/icons';
import { fetchModels, createModel, updateModel, deleteModel } from '../../api/imageApi';

export default function ModelManagement() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchModels();
      setModels(data.models || []);
    } catch (err) {
      message.error('加载模型失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadModels(); }, [loadModels]);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await createModel(values);
      message.success('添加成功');
      form.resetFields();
      setShowForm(false);
      loadModels();
    } catch (err) {
      if (err.errorFields) return;
      message.error('添加失败: ' + err.message);
    }
  };

  const handleEdit = async () => {
    if (!editingId) return;
    try {
      const values = await form.validateFields();
      await updateModel(editingId, values);
      message.success('更新成功');
      form.resetFields();
      setEditingId(null);
      setShowForm(false);
      loadModels();
    } catch (err) {
      if (err.errorFields) return;
      message.error('更新失败: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteModel(id);
      message.success('删除成功');
      loadModels();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const startEdit = (record) => {
    form.setFieldsValue(record);
    setEditingId(record.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    form.resetFields();
    setEditingId(null);
    setShowForm(false);
  };

  const handleCopy = (record) => {
    form.setFieldsValue({
      ...record,
      name: record.name + ' 副本',
      is_default: false
    });
    setEditingId(null);
    setShowForm(true);
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 120 },
    { title: '模型名', dataIndex: 'model_name', key: 'model_name', width: 120 },
    { title: 'API地址', dataIndex: 'api_endpoint', key: 'api_endpoint', width: 200, ellipsis: true },
    { title: '默认', dataIndex: 'is_default', key: 'is_default', width: 60, render: (val) => val ? '是' : '否' },
    {
      title: '操作', key: 'action', width: 120, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(record)} title="复制" />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => startEdit(record)} title="编辑" />
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {!showForm && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)} style={{ marginBottom: 16 }}>
          添加模型
        </Button>
      )}

      {showForm && (
        <div className="model-form-mobile" style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="如: GPT-4" />
            </Form.Item>
            <Form.Item name="model_name" label="模型名" rules={[{ required: true, message: '请输入模型名' }]}>
              <Input placeholder="如: gpt-4" />
            </Form.Item>
            <Form.Item name="api_endpoint" label="API地址" rules={[{ required: true, message: '请输入API地址' }]}>
              <Input placeholder="https://api.openai.com/v1/chat/completions" />
            </Form.Item>
            <Form.Item name="api_key" label="API密钥">
              <Input.Password placeholder="可选" />
            </Form.Item>
            <Form.Item name="is_default" valuePropName="checked">
              <Checkbox>设为默认</Checkbox>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" icon={<SaveOutlined />} onClick={editingId ? handleEdit : handleAdd}>
                  {editingId ? '保存' : '添加'}
                </Button>
                <Button icon={<CloseOutlined />} onClick={cancelEdit}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <Table
          dataSource={models}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 620 }}
        />
      </div>
    </div>
  );
}
