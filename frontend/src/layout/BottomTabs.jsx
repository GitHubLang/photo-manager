import React from 'react';
import { menuItems } from '../config/menu';

/**
 * BottomTabs — 移动端底部导航栏
 * 仅渲染 primary: true 的菜单项
 */
export default function BottomTabs({ activePage, onTabChange }) {
  const tabs = menuItems.filter(item => item.primary);

  return (
    <div className="bottom-tabs">
      <div className="bottom-tabs-inner">
        {tabs.map(item => (
          <button
            key={item.key}
            className={'bottom-tab-item ' + (activePage === item.key ? 'active' : '')}
            onClick={() => onTabChange(item.key)}
          >
            {item.icon ? React.createElement(item.icon) : null}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
