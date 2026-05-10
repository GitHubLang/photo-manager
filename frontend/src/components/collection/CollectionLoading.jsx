import React from 'react';
import { Spin, Button, Typography, Empty } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 合集加载/空/错误状态
 * - loading=true, collections empty → 加载中
 * - collections empty, !generating → 空状态（收藏/全部两种）
 * - currentCollection missing → 无更多合集
 */
export default function CollectionLoading({
  loading,
  collections,
  generating,
  isMobile,
  favoriteOnly,
  setFavoriteOnly,
  handleGenerate
}) {
  // 加载中（首次）
  if (loading && collections.length === 0) {
    return (
      <div style={{ width: '100%', height: isMobile ? '100dvh' : '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', paddingTop: 'env(safe-area-inset-top)' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#fff' }} spin />} />
        <Text style={{ color: '#999', marginTop: 16 }}>生成合集中...</Text>
      </div>
    );
  }

  // 空状态
  if (collections.length === 0 && !generating) {
    return (
      <div style={{ width: '100%', height: isMobile ? '100dvh' : '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', paddingTop: 'env(safe-area-inset-top)' }}>
        <Empty description={<Text style={{ color: '#999' }}>{favoriteOnly ? '还没有收藏的合集' : '还没有照片合集'}</Text>} />
        {favoriteOnly ? (
          <Button type="default" size="large" ghost onClick={() => setFavoriteOnly(false)}
            style={{ marginTop: 20, borderRadius: 24, padding: '8px 32px', color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>查看全部合集</Button>
        ) : (
          <Button type="primary" size="large" onClick={handleGenerate} loading={generating}
            style={{ marginTop: 20, borderRadius: 24, padding: '8px 32px' }}>生成合集</Button>
        )}
      </div>
    );
  }

  // 没有更多合集
  if (collections.length > 0 && !collections[currentIndex]) {
    return null; // 不应该发生，由外层处理
  }

  return null;
}
