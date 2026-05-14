import React from 'react';
import { Menu, Tree } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { menuItems } from '../config/menu';

/**
 * 递归构建树节点
 */
function buildTreeNodes(folders) {
  return folders.map(f => {
    const hasChildren = f.children && f.children.length > 0;
    const label = f.is_root
      ? <span><strong>{f.name}</strong> ({f.imageCount})</span>
      : <span><FolderOutlined /> {f.name}{f.imageCount > 0 && <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.6 }}>{f.imageCount}</span>}</span>;

    const node = { title: label, key: f.path, path: f.path, isLeaf: !hasChildren };
    if (hasChildren) node.children = buildTreeNodes(f.children);
    return node;
  });
}

/**
 * Sidebar — PC 端常驻侧边栏
 */
export default function Sidebar({ collapsed, activePage, folders, selectedFolder, onMenuClick, onFolderSelect }) {
  const treeData = buildTreeNodes(folders);

  const items = buildMenuItems(menuItems, collapsed, treeData, selectedFolder, onFolderSelect);

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

function buildMenuItems(items, collapsed, treeData, selectedFolder, onFolderSelect) {
  return items.map(item => {
    if (item.type === 'divider') {
      return { type: 'divider' };
    }

    // 文件夹：子树是目录树（支持嵌套）
    if (item.key === 'browse') {
      return {
        key: 'browse',
        icon: <item.icon />,
        label: item.label,
        children: !collapsed ? [{
          key: 'folder-tree',
          label: (
            <div style={{ padding: '8px 12px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              <Tree
                className="folder-tree"
                treeData={treeData}
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
