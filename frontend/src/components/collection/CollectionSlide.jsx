import React from 'react';
import { Typography } from 'antd';
import { getProxyUrl } from '../../api/imageApi';

const { Text } = Typography;

/**
 * 合集幻灯片 — 当前照片 + 模糊背景 + 照片序号浮层
 */
export default function CollectionSlide({
  currentPhoto, photoIndex, photos, getProxyUrl: getProxy
}) {
  return (
    <>
      {/* 模糊背景 */}
      {currentPhoto && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `center/cover no-repeat url('${getProxyUrl(currentPhoto)}')`,
          filter: 'blur(20px)', opacity: 0.5, transform: 'scale(1.1)',
        }} />
      )}

      {/* 主图 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentPhoto ? (
          <img src={getProxyUrl(currentPhoto)} alt="" draggable={false}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4, boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }} />
        ) : (
          <Text style={{ color: '#666' }}>图片加载失败</Text>
        )}
      </div>

      {/* 照片序号浮层 */}
      {photos.length > 1 && (
        <div style={{ position: 'absolute', top: 100, right: 16, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 20, padding: '6px 14px', zIndex: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{photoIndex + 1}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>/ {photos.length}</Text>
        </div>
      )}
    </>
  );
}
