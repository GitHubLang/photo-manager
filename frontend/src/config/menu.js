import { FolderOutlined, StarOutlined, FileTextOutlined, SettingOutlined, BgColorsOutlined, PictureOutlined } from '@ant-design/icons';

/**
 * 菜单配置 — 数据驱动
 * 添加新菜单只需在此数组加一项
 * 
 * type: 'submenu' | 'page' | 'modal' | 'divider'
 *   - submenu : 可展开的子菜单，支持 children[] 配置子项
 *   - page    : 点击后切换到对应的页面/面板
 *   - modal   : 点击后弹窗
 *   - divider : 分隔线
 * 
 * primary: true   → 同时显示在移动端底部 tab
 * children: [...] → 子菜单项（仅 type='submenu' 生效）
 */
export const menuItems = [
  {
    key: 'folder',
    icon: FolderOutlined,
    label: '文件夹',
    type: 'submenu',
    primary: true,
    // 文件夹的子菜单是动态的目录树，在 SideMenu 中特殊处理
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
    key: 'collections',
    icon: PictureOutlined,
    label: '照片合集',
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
    type: 'submenu',
    children: [
      { key: 'settings-general',  label: '通用设置' },
      { key: 'settings-models',   label: '模型管理' },
      { key: 'settings-theme',    label: '主题切换' },
    ],
  },
];
