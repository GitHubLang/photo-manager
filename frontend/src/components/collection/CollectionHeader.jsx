import React from 'react';
import { Button, Typography, Spin } from 'antd';
import { LeftOutlined, LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;
const PLACEHOLDER = '⏳ 生成中...';

/**
 * 合集顶部栏 — 返回按钮、模式切换、刷新、标题、标签
 */
export default function CollectionHeader({
  isMobile,
  currentIndex,
  collections,
  favoriteOnly,
  setFavoriteOnly,
  handleGenerate,
  generating,
  onBack,
  currentCollection,
  savedAllIndexRef
}) {
  const isPlaceholder = currentCollection?.title === PLACEHOLDER;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      padding: isMobile ? '40px 16px 16px' : '20px 24px',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Button type="text" icon={<LeftOutlined />} onClick={onBack} style={{ color: '#fff', fontSize: 18 }}>返回</Button>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>合集 {currentIndex + 1} / {collections.length}</Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 合集/收藏 切换 */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' }}>
            <button onClick={() => setFavoriteOnly(false)}
              style={{
                border: 'none', background: !favoriteOnly ? 'rgba(255,255,255,0.25)' : 'transparent',
                color: '#fff', fontSize: 12, padding: '4px 12px', cursor: 'pointer', borderRadius: 0,
                fontWeight: !favoriteOnly ? 600 : 400, transition: 'background 0.2s',
              }}>全部</button>
            <button onClick={() => { savedAllIndexRef.current = currentIndex; setFavoriteOnly(true); }}
              style={{
                border: 'none', background: favoriteOnly ? '#ff4d4f' : 'transparent',
                color: '#fff', fontSize: 12, padding: '4px 12px', cursor: 'pointer', borderRadius: 0,
                fontWeight: favoriteOnly ? 600 : 400, transition: 'background 0.2s',
              }}>我的收藏</button>
          </div>
          <Button size="small" ghost onClick={handleGenerate} loading={generating}
            style={{ borderRadius: 20, fontSize: 12, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>刷新</Button>
        </div>
      </div>

      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 700, display: 'block', textShadow: '0 2px 8px rgba(0,0,0,0.5)', lineHeight: 1.3 }}>
        {isPlaceholder ? (
          <>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 18, color: '#fff' }} spin />} />
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginLeft: 8 }}>文案生成中...</Text>
          </>
        ) : currentCollection?.title}
      </Text>

      {currentCollection?.tags && !isPlaceholder && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {currentCollection.tags.split(' ').filter(Boolean).slice(0, 5).map((tag, i) => (
            <span key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 12 }}>{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
