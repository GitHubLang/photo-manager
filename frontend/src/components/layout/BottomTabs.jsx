import React from 'react';
import { FolderOutlined, StarOutlined, FileTextOutlined } from '@ant-design/icons';

export default function BottomTabs({ activeTab, onTabChange, failedScores }) {
  return (
    <div className="bottom-tabs">
      <div className="bottom-tabs-inner">
        <button className={'bottom-tab-item ' + (activeTab === 'folder' ? 'active' : '')} onClick={() => onTabChange('folder')}>
          <FolderOutlined />
          <span>文件夹</span>
        </button>
        <button className={'bottom-tab-item ' + (activeTab === 'scores' ? 'active' : '')} onClick={() => onTabChange('scores')}>
          <StarOutlined />
          <span>评分</span>
          {failedScores > 0 && <span className="tab-badge">{failedScores}</span>}
        </button>
        <button className={'bottom-tab-item ' + (activeTab === 'captions' ? 'active' : '')} onClick={() => onTabChange('captions')}>
          <FileTextOutlined />
          <span>文案</span>
        </button>
      </div>
    </div>
  );
}
