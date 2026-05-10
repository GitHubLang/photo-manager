import { FolderOutlined, StarOutlined, FileTextOutlined, SettingOutlined, BgColorsOutlined, PictureOutlined } from '@ant-design/icons';

/**
 * 菜单配置 — 全系统唯一配置源
 * 
 * primary: true  → 移动端底部 tab 同时显示该项
 * children: [...] → 子菜单项，设置页内用 Tabs 切换
 * type: 'divider' → 分隔线
 */
export const menuItems = [
  {
    key: 'browse',
    icon: FolderOutlined,
    label: '素材',
    primary: true,
  },
  {
    key: 'scores',
    icon: StarOutlined,
    label: '评分记录',
  },
  {
    key: 'captions',
    icon: FileTextOutlined,
    label: '文案记录',
  },
  { type: 'divider' },
  {
    key: 'collections',
    icon: PictureOutlined,
    label: '照片合集',
    primary: true,
  },
  {
    key: 'lut',
    icon: BgColorsOutlined,
    label: 'LUT克隆',
    primary: true,
  },
  { type: 'divider' },
  {
    key: 'settings',
    icon: SettingOutlined,
    label: '设置',
    children: [
      { key: 'settings-general',  label: '通用设置' },
      { key: 'settings-models',   label: '模型管理' },
      { key: 'settings-theme',    label: '主题切换' },
    ],
  },
];

/** 将菜单项拍平为[key→item]映射（跳过 divider 和 children） */
export function buildMenuMap() {
  const map = {};
  function walk(items) {
    for (const item of items) {
      if (item.type === 'divider') continue;
      map[item.key] = item;
      if (item.children) walk(item.children);
    }
  }
  walk(menuItems);
  return map;
}
