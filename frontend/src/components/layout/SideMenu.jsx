import React from 'react';
import { Menu, Tree } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { menuItems } from '../../config/menu';

/**
 * 侧边菜单 — 从 menuItems 配置生成，支持子菜单
 */
export default function SideMenu({ collapsed, activeMenu, folders, selectedFolder, onMenuClick, onFolderSelect, failedScores, captionCount }) {
  const treeData = folders.map(f => ({
    title: <span><FolderOutlined /> {f.name}<span style={{ marginLeft: 8 }}>{f.imageCount}</span></span>,
    key: f.path,
    path: f.path,
  }));

  // 从配置生成菜单项
  const items = menuItems.map(item => {
    if (item.type === 'divider') {
      return { type: 'divider' };
    }
    if (item.key === 'folder') {
      // 文件夹：特殊处理，子树是目录树
      return {
        key: 'folder',
        icon: <item.icon />,
        label: item.label,
        children: !collapsed ? [{
          key: 'folder-tree',
          label: (
            <div style={{ padding: '8px 12px' }}>
              <Tree treeData={treeData}
                selectedKeys={selectedFolder ? [selectedFolder] : []}
                onSelect={(keys, info) => { if (info.node.path) onFolderSelect(info.node.path); }}
                showIcon={false} />
            </div>
          ),
          type: 'group',
        }] : undefined,
      };
    }
    if (item.type === 'submenu' && item.children && item.children.length > 0) {
      // 通用子菜单：从 children 配置生成
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
    // page 或 modal 类型（单层菜单项）
    return {
      key: item.key,
      icon: <item.icon />,
      label: (
        <span>
          {item.label}
          {item.key === 'scores' && failedScores > 0 && (
            <span style={{ marginLeft: 8, color: 'red' }}>{failedScores}</span>
          )}
        </span>
      ),
    };
  });

  return (
    <Menu mode="inline" selectedKeys={[activeMenu]} onClick={({ key }) => onMenuClick(key)}
      style={{ height: '100%', overflowY: 'auto' }}
      items={items}
    />
  );
}
