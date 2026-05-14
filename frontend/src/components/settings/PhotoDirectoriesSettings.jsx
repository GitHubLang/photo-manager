import React, { useState, useEffect } from 'react';
import { Button, List, Input, InputNumber, message, Typography, Spin, Tag, Space, Popconfirm, Divider, Alert, Modal, Switch, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOpenOutlined, EditOutlined, ScanOutlined, FolderAddOutlined } from '@ant-design/icons';
const { Text, Title } = Typography;

import {
  fetchPhotoDirectories,
  createPhotoDirectory,
  updatePhotoDirectory,
  deletePhotoDirectory,
  togglePhotoDirectory,
  scanPhotoDirectory,
  scanAllFolders,
  fetchScanProgress,
} from '../../api/imageApi';

/**
 * PhotoDirectoriesSettings — 目录管理（DB 驱动）
 * 支持真实目录 + 虚拟目录的完整 CRUD，只操作库不碰文件系统
 */
export default function PhotoDirectoriesSettings() {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanningId, setScanningId] = useState(null);

  // 添加/编辑弹窗
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState(null); // null = 新增
  const [formName, setFormName] = useState('');
  const [formPath, setFormPath] = useState('');
  const [formIsVirtual, setFormIsVirtual] = useState(false);
  const [formParentId, setFormParentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDirectories = () => {
    setLoading(true);
    fetchPhotoDirectories()
      .then(data => setDirectories(data.directories || []))
      .catch(() => message.error('加载照片目录失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDirectories(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setFormName('');
    setFormPath('');
    setFormIsVirtual(false);
    setFormParentId(null);
    setModalVisible(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setFormName(item.name);
    setFormPath(item.path || '');
    setFormIsVirtual(item.is_virtual);
    setFormParentId(item.parent_id);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!formName.trim()) {
      message.warning('请输入目录名称');
      return;
    }
    setSubmitting(true);
    try {
      if (editItem) {
        // 编辑
        await updatePhotoDirectory(editItem.id, {
          name: formName.trim(),
          path: formPath.trim() || null,
          parent_id: formParentId,
        });
        message.success('目录已更新');
      } else {
        // 新增
        await createPhotoDirectory({
          name: formName.trim(),
          path: formPath.trim() || '',
          is_virtual: formIsVirtual,
          parent_id: formParentId,
        });
        message.success('目录已创建');
      }
      setModalVisible(false);
      loadDirectories();
    } catch (err) {
      message.error(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePhotoDirectory(id);
      message.success('目录已删除');
      loadDirectories();
    } catch {
      message.error('删除失败');
    }
  };

  const handleToggle = async (id) => {
    try {
      const data = await togglePhotoDirectory(id);
      message.success(data.is_active ? '目录已启用' : '目录已禁用');
      loadDirectories();
    } catch {
      message.error('操作失败');
    }
  };

  const handleScanSingle = async (dir) => {
    if (dir.is_virtual) {
      message.warning('虚拟目录无需扫描');
      return;
    }
    setScanningId(dir.id);
    try {
      const data = await scanPhotoDirectory(dir.id);
      const result = data.result || {};
      message.success(`扫描完成: ${dir.name} — 新增 ${result.added || 0} 张, 跳过 ${result.skipped || 0} 张`);
      loadDirectories();
    } catch (err) {
      message.error(err.message || '扫描失败');
    } finally {
      setScanningId(null);
    }
  };

  const handleScanAll = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const data = await scanAllFolders();
      const taskId = data.task_id;
      const poll = async () => {
        try {
          const progress = await fetchScanProgress(taskId);
          if (progress.status === 'completed') {
            const result = progress.result;
            setScanResult(result);
            setScanning(false);
            message.success(`全量扫描完成: 新增 ${result.added} 张, 跳过 ${result.skipped} 张`);
          } else if (progress.status === 'running') {
            setTimeout(poll, 2000);
          } else {
            setScanning(false);
            message.error('扫描任务异常');
          }
        } catch { setTimeout(poll, 3000); }
      };
      setTimeout(poll, 1000);
    } catch {
      message.error('启动扫描失败');
      setScanning(false);
    }
  };

  // 可供选择的父目录（排除自身及子代）
  const getParentOptions = () => {
    const excludeIds = editItem ? [editItem.id] : [];
    const flatten = (items) => {
      let result = [];
      for (const d of items) {
        if (!excludeIds.includes(d.id)) {
          result.push({ value: d.id, label: d.name });
        }
        // Items are flat from API already
      }
      return result;
    };
    return flatten(directories.filter(d => !d.is_virtual));
  };

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 680 }}>
        {/* 操作栏 */}
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              新增目录
            </Button>
            <Button icon={<FolderAddOutlined />} onClick={() => {
              setEditItem(null);
              setFormName('');
              setFormPath('');
              setFormIsVirtual(true);
              setFormParentId(null);
              setModalVisible(true);
            }}>
              新建虚拟目录
            </Button>
          </Space>
          <Button onClick={handleScanAll} loading={scanning} size="small">
            {scanning ? '全量扫描中...' : '扫描所有目录'}
          </Button>
        </Space>

        {scanResult && (
          <Alert type="success" message={`全量扫描完成 — 新增 ${scanResult.added} 张, 跳过 ${scanResult.skipped} 张`}
            closable onClose={() => setScanResult(null)} style={{ marginBottom: 12 }} />
        )}

        {/* 目录列表 */}
        <List
          dataSource={directories}
          locale={{ emptyText: '暂无目录，点击"新增目录"添加' }}
          renderItem={item => (
            <List.Item
              actions={[
                <Button key="scan" size="small" icon={<ScanOutlined />}
                  onClick={() => handleScanSingle(item)}
                  loading={scanningId === item.id}
                  disabled={item.is_virtual || !item.is_active}>
                  扫描
                </Button>,
                <Button key="edit" size="small" icon={<EditOutlined />}
                  onClick={() => openEdit(item)}>
                  编辑
                </Button>,
                <Button key="toggle" size="small" onClick={() => handleToggle(item.id)}>
                  {item.is_active ? '禁用' : '启用'}
                </Button>,
                <Popconfirm key="delete" title="确定删除此目录？不会影响文件系统。"
                  onConfirm={() => handleDelete(item.id)} okText="删除" cancelText="取消">
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Tag color={item.is_virtual ? 'purple' : (item.is_active ? 'green' : 'default')}>
                    {item.is_virtual ? '虚拟' : (item.is_active ? '在线' : '已禁用')}
                  </Tag>
                }
                title={
                  <Space>
                    <Text strong style={{ fontSize: 14 }}>{item.name}</Text>
                    {item.path && <Text code style={{ fontSize: 12, opacity: 0.7 }}>{item.path}</Text>}
                    <Text type="secondary" style={{ fontSize: 13 }}>({item.image_count} 张)</Text>
                  </Space>
                }
                description={
                  <Space size="small">
                    {item.parent_id && <Text type="secondary" style={{ fontSize: 12 }}>子目录</Text>}
                    {item.folder_date && <Text type="secondary" style={{ fontSize: 12 }}>{item.folder_date}</Text>}
                    {item.updated_at && <Text type="secondary" style={{ fontSize: 12 }}>更新: {item.updated_at}</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />

        {/* 新增/编辑弹窗 */}
        <Modal
          title={editItem ? '编辑目录' : '新增目录'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          onOk={handleSubmit}
          confirmLoading={submitting}
          okText={editItem ? '保存' : '创建'}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text>目录名称</Text>
              <Input value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="例如：2023年旅行" style={{ marginTop: 4 }} />
            </div>
            {!editItem && (
              <div>
                <Space style={{ marginBottom: 4 }}>
                  <Text>虚拟目录</Text>
                  <Switch checked={formIsVirtual} onChange={v => {
                    setFormIsVirtual(v);
                    if (v) setFormPath('');
                  }} size="small" />
                </Space>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  虚拟目录不关联文件系统路径，照片需手动添加
                </Text>
              </div>
            )}
            {!formIsVirtual && (
              <div>
                <Text>文件系统路径</Text>
                <Input value={formPath} onChange={e => setFormPath(e.target.value)}
                  placeholder="例如: E:\图像\2023" style={{ marginTop: 4 }} disabled={editItem && !editItem.path} />
              </div>
            )}
            <div>
              <Text>父目录（可选）</Text>
              <Select
                value={formParentId}
                onChange={setFormParentId}
                allowClear
                placeholder="无（顶级目录）"
                style={{ width: '100%', marginTop: 4 }}
                options={getParentOptions()}
              />
            </div>
          </Space>
        </Modal>
      </div>
    </Spin>
  );
}
