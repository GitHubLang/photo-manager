import React, { useState, useEffect } from 'react';
import { Button, List, Input, message, Typography, Spin, Tag, Space, Popconfirm, Divider, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons';
const { Text, Title } = Typography;

import {
  fetchPhotoDirectories,
  addPhotoDirectory,
  deletePhotoDirectory,
  togglePhotoDirectory,
  scanAllFolders,
  fetchScanProgress
} from '../../api/imageApi';

/**
 * PhotoDirectoriesSettings — 照片目录管理
 * 支持查看、添加、删除、启用/禁用照片根目录
 */
export default function PhotoDirectoriesSettings() {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPath, setNewPath] = useState('');
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const loadDirectories = () => {
    setLoading(true);
    fetchPhotoDirectories()
      .then(data => {
        setDirectories(data.directories || []);
      })
      .catch(() => message.error('加载照片目录失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDirectories(); }, []);

  const handleAdd = async () => {
    const path = newPath.trim();
    if (!path) {
      message.warning('请输入目录路径');
      return;
    }
    setAdding(true);
    try {
      await addPhotoDirectory(path);
      message.success(`已添加目录: ${path}`);
      setNewPath('');
      loadDirectories();
    } catch (err) {
      message.error(err.message || '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePhotoDirectory(id);
      message.success('已删除目录');
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

  const handleScanAll = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const data = await scanAllFolders();
      const taskId = data.task_id;

      // 轮询进度
      const poll = async () => {
        try {
          const progress = await fetchScanProgress(taskId);
          if (progress.status === 'completed') {
            const result = progress.result;
            setScanResult(result);
            setScanning(false);
            message.success(`扫描完成: 新增 ${result.added} 张, 跳过 ${result.skipped} 张`);
          } else if (progress.status === 'running') {
            setTimeout(poll, 2000);
          } else {
            setScanning(false);
            message.error('扫描任务异常');
          }
        } catch {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 1000);
    } catch {
      message.error('启动扫描失败');
      setScanning(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ maxWidth: 600 }}>
        {/* 添加目录 */}
        <div style={{ marginBottom: 24 }}>
          <Text strong>添加照片目录</Text>
          <Divider />
          <Space style={{ width: '100%', marginTop: 8 }}>
            <Input
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              placeholder="例如: E:\图像"
              style={{ flex: 1 }}
              onPressEnter={handleAdd}
              prefix={<FolderOpenOutlined />}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              loading={adding}
            >
              添加
            </Button>
          </Space>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
            输入完整的目录路径，支持网络路径和映射盘
          </Text>
        </div>

        {/* 现有目录列表 */}
        <div style={{ marginBottom: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text strong>已配置目录 ({directories.length})</Text>
            <Button
              onClick={handleScanAll}
              loading={scanning}
              size="small"
            >
              {scanning ? '扫描中...' : '重新扫描所有目录'}
            </Button>
          </Space>

          {scanResult && (
            <Alert
              type="success"
              message={`扫描完成 — 新增 ${scanResult.added} 张图片, 跳过 ${scanResult.skipped} 张`}
              closable
              onClose={() => setScanResult(null)}
              style={{ marginBottom: 12 }}
            />
          )}

          <List
            dataSource={directories}
            locale={{ emptyText: '暂无照片目录，请添加 E:\图像 或其他目录' }}
            renderItem={item => (
              <List.Item
                actions={[
                  <Button
                    key="toggle"
                    size="small"
                    onClick={() => handleToggle(item.id)}
                  >
                    {item.is_active ? '禁用' : '启用'}
                  </Button>,
                  <Popconfirm
                    key="delete"
                    title="确定删除此目录？不会影响已索引的图片。"
                    onConfirm={() => handleDelete(item.id)}
                    okText="删除"
                    cancelText="取消"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    <Tag color={item.is_active ? (item.exists ? 'green' : 'orange') : 'default'}>
                      {item.is_active ? (item.exists ? '在线' : '离线') : '已禁用'}
                    </Tag>
                  }
                  title={
                    <Space>
                      <Text code>{item.path}</Text>
                    </Space>
                  }
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      添加时间: {item.created_at || '未知'}
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      </div>
    </Spin>
  );
}
