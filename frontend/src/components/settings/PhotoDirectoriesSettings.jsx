import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, message, Typography, Spin, Progress, Tooltip, Popconfirm, Switch, Select, Space } from 'antd';
import {
  PlusOutlined, ScanOutlined, EditOutlined, DeleteOutlined,
  PauseCircleOutlined, FolderAddOutlined, LoadingOutlined,
  FolderOutlined, FolderOpenOutlined, RightOutlined
} from '@ant-design/icons';
const { Text } = Typography;

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
 * VirtualTweak — toggle chip for real vs virtual
 */
function TypeChip({ isVirtual, onClick }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 4,
        fontSize: 11, fontWeight: 500, cursor: 'pointer',
        background: isVirtual ? '#f3e8ff' : '#d1fae5',
        color: isVirtual ? '#7c3aed' : '#065f46',
        transition: 'opacity 150ms',
        userSelect: 'none',
      }}
    >
      {isVirtual ? '✦ 虚拟' : '◉ 本地'}
    </span>
  );
}

/**
 * PhotoDirectoriesSettings — 干净优雅的目录管理界面
 */
export default function PhotoDirectoriesSettings() {
  const [directories, setDirectories] = useState([]);
  const [loading, setLoading] = useState(true);

  // 折叠状态
  const [expandedSet, setExpandedSet] = useState(new Set());

  const toggleExpand = useCallback((id) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 全部默认折叠（不展开任何目录）

  // 添加表单
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPath, setAddPath] = useState('');
  const [addIsVirtual, setAddIsVirtual] = useState(false);
  const [adding, setAdding] = useState(false);

  // 编辑表单
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');

  // 扫描进度
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(null); // { current, total, current_folder }
  const [scanDone, setScanDone] = useState(null); // { added, skipped }

  // 单目录扫描
  const [scanningId, setScanningId] = useState(null);

  const loadDirectories = () => {
    setLoading(true);
    fetchPhotoDirectories()
      .then(data => setDirectories(data.directories || []))
      .catch(() => message.error('加载目录失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDirectories(); }, []);

  // ===== 构建树 =====
  const childrenMap = {};
  const dirMap = {};
  for (const d of directories) {
    const pid = d.parent_id || 0;
    if (!childrenMap[pid]) childrenMap[pid] = [];
    childrenMap[pid].push(d);
    dirMap[d.id] = d;
  }

  const renderTree = (parentId = 0, depth = 0) => {
    const items = childrenMap[parentId] || [];
    if (items.length === 0 && depth === 0) {
      return (
        <div className="dir-list-empty">
          <FolderOpenOutlined style={{ fontSize: 32, display: 'block', marginBottom: 12, opacity: 0.3 }} />
          暂无目录，点击上方「新增目录」添加
        </div>
      );
    }
    return items.map(d => {
      const childCount = (childrenMap[d.id] || []).length;
      const isExpanded = expandedSet.has(d.id);
      const showChildren = childCount > 0 && isExpanded;

      return (
        <React.Fragment key={d.id}>
          <div className={`dir-row depth-${Math.min(depth, 4)}${!d.is_active ? ' is-disabled' : ''}`}>
            {/* 折叠箭头 */}
            <span
              className={`dir-toggle ${childCount > 0 ? (isExpanded ? 'expanded' : '') : 'leaf'}`}
              onClick={() => childCount > 0 && toggleExpand(d.id)}
            >
              {childCount > 0 ? <RightOutlined style={{ fontSize: 11 }} /> : null}
            </span>

            {/* 状态圆点 */}
            <span className={`dir-status-dot ${d.is_virtual ? 'virtual' : d.is_active ? 'online' : 'disabled'}`} />

            {/* 信息 */}
            <div className="dir-info">
              <div className="dir-name">
                <span
                  style={{ cursor: childCount > 0 ? 'pointer' : 'default' }}
                  onClick={() => childCount > 0 && toggleExpand(d.id)}
                >
                  {d.name}
                </span>
                {!d.is_active && <span style={{ fontSize: 11, color: '#9c9c9c', marginLeft: 6 }}>已禁用</span>}
                <span className="dir-badge">{calcAggregated(d.id)} 张</span>
              </div>
              {d.path && <div className="dir-path">{d.path}</div>}
            </div>

            {/* 操作按钮 */}
            <div className="dir-actions">
              <Tooltip title="扫描">
                <Button size="small" icon={<ScanOutlined />}
                  onClick={() => handleScan(d)}
                  loading={scanningId === d.id}
                  disabled={d.is_virtual || !d.is_active || !d.path} />
              </Tooltip>
              <Tooltip title="编辑">
                <Button size="small" icon={<EditOutlined />}
                  onClick={() => startEdit(d)} />
              </Tooltip>
              <Tooltip title={d.is_active ? '禁用' : '启用'}>
                <Button size="small" icon={<PauseCircleOutlined />}
                  onClick={() => handleToggle(d.id)} />
              </Tooltip>
              <Popconfirm title={`删除「${d.name}」？`} description="仅删除数据库记录，不影响文件系统"
                onConfirm={() => handleDelete(d.id)} okText="删除" cancelText="取消" placement="left">
                <Tooltip title="删除">
                  <Button size="small" className="danger" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            </div>
          </div>
          {showChildren && renderTree(d.id, depth + 1)}
        </React.Fragment>
      );
    });
  };

  // ===== 操作 =====

  const handleAdd = async () => {
    const name = addName.trim();
    if (!name) { message.warning('请输入目录名称'); return; }
    setAdding(true);
    try {
      await createPhotoDirectory({
        name, path: addPath.trim(),
        is_virtual: addIsVirtual,
      });
      message.success(addIsVirtual ? '虚拟目录已创建' : '目录已添加');
      setAddName(''); setAddPath(''); setShowAddForm(false);
      loadDirectories();
    } catch (err) {
      message.error(err.message || '添加失败');
    } finally { setAdding(false); }
  };

  const startEdit = (d) => {
    setEditingId(d.id);
    setEditName(d.name);
    setEditPath(d.path || '');
  };

  const saveEdit = async () => {
    if (!editName.trim()) { message.warning('名称不能为空'); return; }
    try {
      await updatePhotoDirectory(editingId, { name: editName.trim(), path: editPath.trim() || null });
      message.success('已更新');
      setEditingId(null);
      loadDirectories();
    } catch (err) {
      message.error(err.message || '更新失败');
    }
  };

  const cancelEdit = () => setEditingId(null);

  const handleDelete = async (id) => {
    try {
      await deletePhotoDirectory(id);
      loadDirectories();
    } catch { message.error('删除失败'); }
  };

  const handleToggle = async (id) => {
    try {
      await togglePhotoDirectory(id);
      loadDirectories();
    } catch { message.error('操作失败'); }
  };

  const handleScan = async (d) => {
    if (d.is_virtual) { message.warning('虚拟目录不需要扫描'); return; }
    setScanningId(d.id);
    try {
      const data = await scanPhotoDirectory(d.id);
      const r = data.result || {};
      message.success(`${d.name}: 新增 ${r.added || 0} 张, 跳过 ${r.skipped || 0} 张`);
      loadDirectories();
    } catch (err) {
      message.error(err.message || '扫描失败');
    } finally { setScanningId(null); }
  };

  const handleScanAll = async () => {
    setScanning(true);
    setScanProgress(null);
    setScanDone(null);
    try {
      const data = await scanAllFolders();
      const taskId = data.task_id;
      const poll = async () => {
        try {
          const p = await fetchScanProgress(taskId);
          if (p.status === 'completed') {
            setScanDone(p.result || {});
            setScanning(false);
            setScanProgress(null);
            message.success(`全量扫描完成: 新增 ${(p.result || {}).added || 0} 张`);
            loadDirectories();
          } else if (p.status === 'running') {
            setScanProgress(p.progress);
            setTimeout(poll, 2000);
          } else {
            setScanning(false);
            setScanProgress(null);
            message.error('扫描异常');
          }
        } catch { setTimeout(poll, 3000); }
      };
      setTimeout(poll, 1000);
    } catch {
      message.error('启动扫描失败');
      setScanning(false);
    }
  };

  const totalImages = directories.reduce((s, d) => d.parent_id ? s : s + d.image_count, 0);
  // Actually use aggregated counts: top-level only
  const topLevelCounts = directories
    .filter(d => !d.parent_id)
    .reduce((s, d) => s + (calcAggregated(d.id)), 0);

  // Calculate aggregated count for a directory
  function calcAggregated(dirId) {
    const d = dirMap[dirId];
    if (!d) return 0;
    const children = childrenMap[dirId] || [];
    let total = d.image_count || 0;
    for (const c of children) total += calcAggregated(c.id);
    return total;
  }

  return (
    <Spin spinning={loading}>
      <div className="settings-page-inner">

        {/* 工具栏 */}
        <div className="dir-toolbar">
          <div className="dir-toolbar-left">
            <span className="dir-toolbar-summary">
              照片目录
              <span className="dir-toolbar-count">{directories.filter(d => !d.parent_id).length} 个根目录 · {totalImages.toLocaleString()} 张</span>
            </span>
          </div>
          <Space size="small">
            <Button size="small" icon={<ScanOutlined />} onClick={handleScanAll} loading={scanning}>
              {scanning ? '扫描中' : '全量扫描'}
            </Button>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setShowAddForm(true)}>
              新增目录
            </Button>
          </Space>
        </div>

        {/* 扫描进度 */}
        {scanProgress && (
          <div className="scan-progress-banner">
            <LoadingOutlined />
            <Progress percent={Math.round((scanProgress.current / scanProgress.total) * 100)}
              size="small" format={() => `${scanProgress.current}/${scanProgress.total}`} />
            <span style={{ flexShrink: 0 }}>{scanProgress.current_folder || '...'}</span>
          </div>
        )}
        {scanDone && (
          <div className="scan-progress-banner" style={{ background: '#d1fae5' }}>
            <span>✓ 扫描完成: 新增 {scanDone.added || 0} 张, 跳过 {scanDone.skipped || 0} 张</span>
            <Button size="small" type="text" onClick={() => setScanDone(null)} style={{ marginLeft: 'auto' }}>
              关闭
            </Button>
          </div>
        )}

        {/* 添加表单 */}
        {showAddForm && (
          <div className="dir-add-card" style={{ animation: 'slideUp 200ms ease' }}>
            <div className="settings-card-title">新增目录</div>
            <div className="settings-card-desc">添加真实目录到文件系统，或创建虚拟目录手动整理照片</div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <Input value={addName} onChange={e => setAddName(e.target.value)}
                placeholder="目录名称" style={{ flex: 1 }}
                onPressEnter={handleAdd}
                prefix={addIsVirtual ? <FolderAddOutlined /> : <FolderOutlined />} />
              <TypeChip isVirtual={addIsVirtual} onClick={() => setAddIsVirtual(!addIsVirtual)} />
            </div>

            {!addIsVirtual && (
              <Input value={addPath} onChange={e => setAddPath(e.target.value)}
                placeholder="文件系统路径，例如 E:\图像\2023"
                style={{ marginBottom: 12 }}
                onPressEnter={handleAdd} />
            )}

            {addIsVirtual && (
              <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
                虚拟目录不关联文件路径，创建后可以通过图片浏览页面手动添加照片
              </Text>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button onClick={() => { setShowAddForm(false); setAddIsVirtual(false); }}>取消</Button>
              <Button type="primary" onClick={handleAdd} loading={adding}>
                {addIsVirtual ? '创建虚拟目录' : '添加目录'}
              </Button>
            </div>
          </div>
        )}

        {/* 目录列表 */}
        <div className="settings-card">
          {editingId !== null && (() => {
            const d = dirMap[editingId];
            if (!d) return null;
            return (
              <div style={{
                padding: '12px 16px', marginBottom: 12,
                background: '#f0fdf4', borderRadius: 8,
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>编辑目录</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <Input value={editName} onChange={e => setEditName(e.target.value)}
                    placeholder="名称" style={{ flex: 1 }} onPressEnter={saveEdit} />
                </div>
                {d.path !== null && (
                  <Input value={editPath} onChange={e => setEditPath(e.target.value)}
                    placeholder="路径" style={{ marginBottom: 8 }} onPressEnter={saveEdit} />
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={cancelEdit}>取消</Button>
                  <Button size="small" type="primary" onClick={saveEdit}>保存</Button>
                </div>
              </div>
            );
          })()}
          <div className="dir-list">
            {renderTree()}
          </div>
        </div>
      </div>
    </Spin>
  );
}
