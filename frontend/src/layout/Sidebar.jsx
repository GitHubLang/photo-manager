import React from 'react';
import { Menu, Tree } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { menuItems } from '../config/menu';

/**
 * Sidebar — PC 端常驻侧边栏
 */
export default function Sidebar({ collapsed, activePage, folders, selectedFolder, onMenuClick, onFolderSelect }) {
  const treeData = folders.map(f => ({
    title: <span><FolderOutlined /> {f.name}<span style={{ marginLeft: 8 }}>{f.imageCount}</span></span>,
    key: f.path,
    path: f.path,
  }));

  const items = buildMenuItems(menuItems, collapsed, folders, selectedFolder, onFolderSelect);

  return (
    <Menu
      mode="inline"
      selectedKeys={[activePage]}
      onClick={({ key }) => onMenuClick(key)}
      style={{ height: '100%', overflowY: 'auto' }}
      items={items}
    />
  );
}

function buildMenuItems(items, collapsed, folders, selectedFolder, onFolderSelect) {
  return items.map(item => {
    if (item.type === 'divider') {
      return { type: 'divider' };
    }

    // 文件夹：子树是目录树
    if (item.key === 'browse') {
      return {
        key: 'browse',
        icon: <item.icon />,
        label: item.label,
        children: !collapsed ? [{
          key: 'folder-tree',
          label: (
            <div style={{ padding: '8px 12px' }}>
              <Tree
                treeData={folders.map(f => ({
                  title: <span><FolderOutlined /> {f.name}<span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>{f.imageCount}</span></span>,
                  key: f.path,
                  path: f.path,
                }))}
                selectedKeys={selectedFolder ? [selectedFolder] : []}
                onSelect={(keys, info) => { if (info.node.path) onFolderSelect(info.node.path); }}
                showIcon={false}
              />
            </div>
          ),
          type: 'group',
        }] : undefined,
      };
    }

    // 子菜单
    if (item.children && item.children.length > 0) {
      return {
        key: item.key,
        icon: <item.icon />,
        label: item.label,
        children: item.children.map(child => ({
          key: child.key,
          label: child.label,
        })),
      };
    }

    // 普通菜单项
    return {
      key: item.key,
      icon: <item.icon />,
      label: item.label,
    };
  });
}
