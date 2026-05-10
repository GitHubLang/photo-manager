import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;
const PLACEHOLDER = '⏳ 生成中...';

/**
 * 合集底部栏 — 描述文案、进度指示器、照片序号
 */
export default function CollectionFooter({
  currentCollection,
  photoIndex,
  photos,
  isMobile
}) {
  const isPlaceholder = currentCollection?.title === PLACEHOLDER;

  return (
    <div style={{
      position: 'absolute',
      bottom: `calc(0px + env(safe-area-inset-bottom, 0px))`,
      left: 0, right: 0,
      padding: '32px 16px 16px',
      background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
      zIndex: 10,
    }}>
      <Text style={{
        color: isPlaceholder ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)',
        fontSize: 14,
        lineHeight: 1.5,
        display: 'block',
        textShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }}>
        {isPlaceholder ? '正在生成文案...' : currentCollection?.description}
      </Text>

      {/* 照片进度指示器 */}
      {photos.length > 1 && (
        <div style={{ display: 'flex', gap: 3, marginTop: 10, justifyContent: 'center' }}>
          {photos.slice(0, Math.min(photos.length, 12)).map((_, i) => (
            <div key={i} style={{
              width: `${Math.max(4, 80 / Math.min(photos.length, 12))}px`,
              height: 3,
              borderRadius: 2,
              background: i === photoIndex ? '#fff' : 'rgba(255,255,255,0.3)',
              transition: 'background 0.3s',
            }} />
          ))}
          {photos.length > 12 && (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 4 }}>+{photos.length - 12}</Text>
          )}
        </div>
      )}

      {/* 照片序号 */}
      <div style={{ textAlign: 'center', marginTop: 6 }}>
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          {photoIndex + 1} / {photos.length}
        </Text>
      </div>
    </div>
  );
}
