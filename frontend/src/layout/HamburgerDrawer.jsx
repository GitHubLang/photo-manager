import React from 'react';
import { Button, Typography, Menu } from 'antd';
const { Text } = Typography;
import { FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { menuItems } from '../config/menu';

/**
 * 递归构建文件夹菜单项（支持嵌套结构）
 */
function buildFolderMenuItems(folders, depth = 0) {
  return folders.map(f => {
    const hasChildren = f.children && f.children.length > 0;
    const prefix = f.is_root ? <FolderOpenOutlined /> : <FolderOutlined />;
    const label = (
      <span style={{ paddingLeft: depth > 0 ? depth * 12 : 0 }}>
        {prefix} {f.name}
        {f.imageCount > 0 && <span style={{ marginLeft: 6, color: '#999', fontSize: 12 }}>{f.imageCount}</span>}
      </span>
    );

    const menuItem = {
      key: '__folder__' + f.path,
      label,
    };

    if (hasChildren) {
      menuItem.children = buildFolderMenuItems(f.children, depth + 1);
    }

    return menuItem;
  });
}

/**
 * HamburgerDrawer — 移动端菜单抽屉
 * 从左侧滑出，所有菜单项可滚动，文件夹支持嵌套
 */
export default function HamburgerDrawer({ open, activePage, folders, onClose, onMenuSelect, onFolderSelect }) {
  const treeItems = buildTree(menuItems, folders);

  return (
    <div className={'hamburger-drawer ' + (open ? 'open' : '')}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="hamburger-drawer-backdrop" onClick={onClose} />
      <div className="hamburger-drawer-panel">
        <div className="hamburger-drawer-header">
          <Text strong>菜单</Text>
          <Button type="text" size="small" onClick={onClose}>关闭</Button>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activePage]}
          items={treeItems}
          onClick={({ key }) => {
            onMenuSelect(key);
            onClose();
          }}
        />
      </div>
    </div>
  );
}

function buildTree(items, folders) {
  return items
    .filter(item => item.type !== 'divider')
    .map(item => {
      // 素材：子项是文件夹列表（支持嵌套递归）
      if (item.key === 'browse') {
        const folderChildren = buildFolderMenuItems(folders);
        return {
          key: 'browse',
          icon: item.icon ? React.createElement(item.icon) : undefined,
          label: item.label,
          children: folderChildren.length > 0 ? folderChildren : undefined,
        };
      }

      // 子菜单
      if (item.children && item.children.length > 0) {
        return {
          key: item.key,
          icon: item.icon ? React.createElement(item.icon) : undefined,
          label: item.label,
          children: item.children.map(child => ({
            key: child.key,
            label: child.label,
          })),
        };
      }

      return {
        key: item.key,
        icon: item.icon ? React.createElement(item.icon) : undefined,
        label: item.label,
      };
    });
}
