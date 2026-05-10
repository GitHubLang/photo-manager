import React from 'react';
import { menuItems } from '../../config/menu';

function iconFromConfig(iconConfig) {
  return iconConfig ? React.createElement(iconConfig) : null;
}

export default function BottomTabs({ activeMenu, onTabChange, failedScores }) {
  const tabs = menuItems.filter(item => item.primary);
  return (
    <div className="bottom-tabs">
      <div className="bottom-tabs-inner">
        {tabs.map(item => (
          <button
            key={item.key}
            className={'bottom-tab-item ' + (activeMenu === item.key ? 'active' : '')}
            onClick={() => onTabChange(item.key)}
          >
            {iconFromConfig(item.icon)}
            <span>{item.label}</span>
            {item.key === 'scores' && failedScores > 0 && <span className="tab-badge">{failedScores}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
