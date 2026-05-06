import React from 'react';
import { Tree, Button, Typography, Menu } from 'antd';
const { Text } = Typography;
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
 */
function buildMenuTree(items) {
  return items
    .filter(item => item.type !== 'divider')
    .map(item => {
      const hasChildren = item.children && item.children.length > 0;
      return {
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: hasChildren ? buildMenuTree(item.children) : undefined,
      };
    });
}

export function MenuDrawer({ open, onClose, onMenuSelect }) {
  const menuTreeItems = buildMenuTree(menuItems);

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
