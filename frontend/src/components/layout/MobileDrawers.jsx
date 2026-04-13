import React from 'react';
import { Tree, Button, Typography } from 'antd';
const { Text } = Typography;

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
