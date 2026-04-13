import React from 'react';
import { Menu, Tree } from 'antd';
import { FolderOutlined, StarOutlined, FileTextOutlined } from '@ant-design/icons';

export default function SideMenu({ collapsed, activeMenu, folders, selectedFolder, onMenuClick, onFolderSelect, failedScores, captionCount }) {
  const treeData = folders.map(f => ({
    title: <span><FolderOutlined /> {f.name}<span style={{ marginLeft: 8 }}>{f.imageCount}</span></span>,
    key: f.path,
    path: f.path,
  }));

  return (
    <Menu mode="inline" selectedKeys={[activeMenu]} onClick={({ key }) => onMenuClick(key)}
      style={{ height: '100%', overflowY: 'auto' }}>
      <Menu.SubMenu key="folder" icon={<FolderOutlined />} title="文件夹">
        {!collapsed && (
          <div style={{ padding: '8px 12px' }}>
            <Tree treeData={treeData} selectedKeys={selectedFolder ? [selectedFolder] : []}
              onSelect={(keys, info) => { if (info.node.path) onFolderSelect(info.node.path); }} showIcon={false} />
          </div>
        )}
      </Menu.SubMenu>
      <Menu.Item key="scores" icon={<StarOutlined />}>
        评分记录
        {failedScores > 0 && <span style={{ marginLeft: 8, color: 'red' }}>{failedScores}</span>}
      </Menu.Item>
      <Menu.Item key="captions" icon={<FileTextOutlined />}>文案记录</Menu.Item>
    </Menu>
  );
}
