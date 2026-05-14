import React from 'react';
import { Menu, Tree } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { menuItems } from '../../config/menu';

/**
 * 递归构建树节点
 * 支持嵌套文件夹结构（多根目录 + 子目录递归）
 */
function buildTreeNodes(folders) {
  return folders.map(f => {
    const hasChildren = f.children && f.children.length > 0;
    // 显示图片数量，根目录特殊标记
    const label = f.is_root
      ? <span><strong>{f.name}</strong> ({f.imageCount})</span>
      : <span><FolderOutlined /> {f.name}{f.imageCount > 0 && <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.6 }}>{f.imageCount}</span>}</span>;

    const node = {
      title: label,
      key: f.path,
      path: f.path,
      isLeaf: !hasChildren,
    };

    if (hasChildren) {
      node.children = buildTreeNodes(f.children);
    }

    return node;
  });
}

/**
 * 侧边菜单 — 从 menuItems 配置生成，支持子菜单
 * 文件夹区域使用可展开的目录树（支持嵌套）
 */
export default function SideMenu({ collapsed, activeMenu, folders, selectedFolder, onMenuClick, onFolderSelect, failedScores, captionCount }) {
  const treeData = buildTreeNodes(folders);

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
            <div style={{ padding: '8px 12px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
              <Tree
                treeData={treeData}
                selectedKeys={selectedFolder ? [selectedFolder] : []}
                onSelect={(keys, info) => {
                  if (info.node.path) onFolderSelect(info.node.path);
                }}
                defaultExpandAll={false}
                defaultExpandedKeys={treeData.map(n => n.key)}
                showIcon={false}
                style={{ fontSize: 13 }}
              />
            </div>
          ),
          type: 'group',
        }] : undefined,
      };
    }
    if (item.type === 'submenu' && item.children && item.children.length > 0) {
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
