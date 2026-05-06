import { FolderOutlined, StarOutlined, FileTextOutlined, SettingOutlined, BgColorsOutlined } from '@ant-design/icons';

/**
 * 菜单配置 — 数据驱动
 * 添加新菜单只需在此数组加一项
 * 
 * type: 'submenu' | 'page' | 'modal' | 'divider'
 * 
 * 未来扩展示例：
 *   { key: 'upload', icon: UploadOutlined, label: '上传评分', type: 'page' },
 *   { key: 'editor', icon: EditOutlined,   label: '照片编辑', type: 'page' },
 */
export const menuItems = [
  {
    key: 'folder',
    icon: FolderOutlined,
    label: '文件夹',
    type: 'submenu',
    primary: true,   // 显示在移动端底部 tab
  },
  {
    key: 'scores',
    icon: StarOutlined,
    label: '评分记录',
    type: 'page',
    primary: true,
  },
  {
    key: 'captions',
    icon: FileTextOutlined,
    label: '文案记录',
    type: 'page',
    primary: true,
  },
  { type: 'divider' },
  {
    key: 'lut',
    icon: BgColorsOutlined,
    label: 'LUT克隆',
    type: 'page',
  },
  { type: 'divider' },
  {
    key: 'settings',
    icon: SettingOutlined,
    label: '设置',
    type: 'modal',
  },
];
