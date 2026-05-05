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

export function MenuDrawer({ open, onClose, onMenuSelect }) {
  const menuTreeItems = menuItems
    .filter(item => item.type !== 'divider')
    .map(item => ({
      key: item.key,
      label: item.label,
    }));

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
