import React from 'react';
import { Tree, Button, Typography, Menu } from 'antd';
const { Text } = Typography;
import { FolderOutlined } from '@ant-design/icons';
import { menuItems } from '../../config/menu';

export function FolderDrawer({ open, onClose, treeData, selectedFolder, onSelect }) {
  return (
    <div className={'folder-drawer ' + (open ? 'open' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="folder-drawer-backdrop" onClick={onClose} />
      <div className="folder-drawer-panel">
        <div className="folder-drawer-header">
          <Text strong>选择文件夹</Text>
          <Button type="text" size="small" onClick={onClose}>关闭</Button>
        </div>
        <div className="folder-drawer-content">
          <Tree treeData={treeData} selectedKeys={selectedFolder ? [selectedFolder] : []}
            onSelect={(keys, info) => { if (info.node.path) { onSelect(info.node.path); onClose(); } }} showIcon={false} />
        </div>
      </div>
    </div>
  );
}

/**
 * 递归构建 SubMenu / MenuItem 树
 * "文件夹"特殊处理：用 folders 列表动态生成子项
 */
function buildMenuTree(items, folders) {
  return items
    .filter(item => item.type !== 'divider')
    .map(item => {
      // 文件夹：子菜单项从 folders 列表动态生成
      if (item.key === 'folder') {
        return {
          key: 'folder',
          icon: item.icon ? React.createElement(item.icon) : undefined,
          label: item.label,
          children: (folders || []).map(f => ({
            key: f.path,
            icon: React.createElement(FolderOutlined),
            label: React.createElement('span', null,
              f.name,
              React.createElement('span', { style: { marginLeft: 8, color: '#999', fontSize: 12 } }, f.imageCount)
            ),
          })),
        };
      }
      const hasChildren = item.children && item.children.length > 0;
      return {
        key: item.key,
        icon: item.icon ? React.createElement(item.icon) : undefined,
        label: item.label,
        children: hasChildren ? buildMenuTree(item.children) : undefined,
      };
    });
}

export function MenuDrawer({ open, onClose, onMenuSelect, folders }) {
  const menuTreeItems = buildMenuTree(menuItems, folders);

  return (
    <div className={'folder-drawer ' + (open ? 'open' : '')} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="folder-drawer-backdrop" onClick={onClose} />
      <div className="folder-drawer-panel">
        <div className="folder-drawer-header">
          <Text strong>菜单</Text>
          <Button type="text" size="small" onClick={onClose}>关闭</Button>
        </div>
        <Menu
          mode="inline"
          items={menuTreeItems}
          onClick={({ key }) => { onMenuSelect(key); onClose(); }}
        />
      </div>
    </div>
  );
}
