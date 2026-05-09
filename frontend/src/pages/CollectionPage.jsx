import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, message, Spin, Typography, Empty } from 'antd';
import { HeartOutlined, HeartFilled, LoadingOutlined, LeftOutlined } from '@ant-design/icons';
import { generateCollections, fetchCollections, toggleCollectionFavorite, getProxyUrl, clearAllCollections } from '../api/imageApi';
import { fetchSettings } from '../api/imageApi';

const { Text } = Typography;

/**
 * 抖音图集风格照片合集页面
 * - 竖向滑动切换合集（上滑下一个 / 下滑上一个）
 * - 横向滑动切换合集内照片
 * - 自动轮播（3秒）
 * - 收藏功能
 * - 醒目照片序号浮层
 */
export default function CollectionPage({ isMobile, onBack }) {
  const [collections, setCollections] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [llmModel, setLlmModel] = useState('');
  const autoPlayRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);

  // 加载设置中的 LLM 模型
  useEffect(() => {
    fetchSettings()
      .then(data => {
        if (data.caption_llm_model) setLlmModel(data.caption_llm_model);
      })
      .catch(() => {});
  }, []);

  // 生成合集（清空旧的再生成）
  const handleGenerate = useCallback(async (model) => {
    setGenerating(true);
    setLoading(true);
    try {
      // 先清空旧的
      await clearAllCollections();
      // 再生成新的
      const data = await generateCollections(20, model || llmModel);
      if (data.success && data.collections && data.collections.length > 0) {
        setCollections(data.collections);
        setCurrentIndex(0);
        setPhotoIndex(0);
        message.success(`生成了 ${data.collections.length} 个合集`);
      } else {
        message.error('生成失败');
      }
    } catch (err) {
      console.error('生成合集失败:', err);
      message.error('生成请求失败');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [llmModel]);

  // 首次进入：直接生成
  useEffect(() => {
    if (!initializedRef.current && !favoriteOnly) {
      initializedRef.current = true;
      handleGenerate();
    }
  }, [favoriteOnly, handleGenerate]);

  // 收藏模式：从数据库加载
  useEffect(() => {
    if (favoriteOnly) {
      setLoading(true);
      fetchCollections(1, 50, true)
        .then(data => {
          if (data.collections && data.collections.length > 0) {
            setCollections(data.collections);
            setCurrentIndex(0);
            setPhotoIndex(0);
          } else {
            setCollections([]);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [favoriteOnly]);

  // 自动轮播
  useEffect(() => {
    if (autoPlay && collections.length > 0 && collections[currentIndex]) {
      const photos = collections[currentIndex].photo_paths || [];
      if (photos.length <= 1) return;
      autoPlayRef.current = setInterval(() => {
        setPhotoIndex(prev => (prev + 1) % photos.length);
      }, 3000);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [autoPlay, currentIndex, collections]);

  // 切换合集
  const goToPrevCollection = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setPhotoIndex(0);
    }
  }, [currentIndex]);

  const goToNextCollection = useCallback(() => {
    if (currentIndex < collections.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setPhotoIndex(0);
    }
  }, [currentIndex, collections.length]);

  // 横向切换照片
  const nextPhoto = useCallback(() => {
    const photos = collections[currentIndex]?.photo_paths || [];
    if (photos.length > 1) {
      setPhotoIndex(prev => (prev + 1) % photos.length);
      setAutoPlay(false);
      setTimeout(() => setAutoPlay(true), 5000);
    }
  }, [currentIndex, collections]);

  const prevPhoto = useCallback(() => {
    const photos = collections[currentIndex]?.photo_paths || [];
    if (photos.length > 1) {
      setPhotoIndex(prev => (prev - 1 + photos.length) % photos.length);
      setAutoPlay(false);
      setTimeout(() => setAutoPlay(true), 5000);
    }
  }, [currentIndex, collections]);

  // 收藏
  const handleFavorite = async (e) => {
    e.stopPropagation();
    const col = collections[currentIndex];
    if (!col) return;
    try {
      const data = await toggleCollectionFavorite(col.id);
      if (data.success) {
        const newCols = [...collections];
        newCols[currentIndex] = { ...newCols[currentIndex], is_favorite: data.is_favorite };
        setCollections(newCols);
        message.success(data.is_favorite ? '已收藏' : '已取消收藏');
      }
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 触摸事件
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (Math.max(absX, absY) < 50) return;
    if (absY > absX) {
      if (deltaY < 0) goToNextCollection();
      else goToPrevCollection();
    } else {
      if (deltaX < 0) nextPhoto();
      else prevPhoto();
    }
  };

  const handleWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      if (e.deltaX > 0) nextPhoto();
      else prevPhoto();
    } else {
      if (e.deltaY > 0) goToNextCollection();
      else goToPrevCollection();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowDown': goToNextCollection(); break;
        case 'ArrowUp': goToPrevCollection(); break;
        case 'ArrowRight': nextPhoto(); break;
        case 'ArrowLeft': prevPhoto(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextCollection, goToPrevCollection, nextPhoto, prevPhoto]);

  // 加载中
  if (loading && collections.length === 0) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#fff' }} spin />} />
        <Text style={{ color: '#999', marginTop: 16 }}>生成合集中...</Text>
      </div>
    );
  }

  if (collections.length === 0 && !generating) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        <Empty description={<Text style={{ color: '#999' }}>还没有照片合集</Text>} />
        <Button type="primary" size="large" onClick={handleGenerate} loading={generating}
          style={{ marginTop: 20, borderRadius: 24, padding: '8px 32px' }}>
          生成合集
        </Button>
      </div>
    );
  }

  const currentCollection = collections[currentIndex];
  if (!currentCollection) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        <Text>没有更多合集了</Text>
        <Button type="link" onClick={handleGenerate}>生成新合集</Button>
      </div>
    );
  }

  const photos = currentCollection.photo_paths || [];
  const currentPhoto = photos[photoIndex];
  const isFav = currentCollection.is_favorite;

  return (
    <div ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onWheel={handleWheel}
      style={{ width: '100%', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden', userSelect: 'none' }}>

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

      {/* ====== 醒目的照片序号浮层 ====== */}
      {photos.length > 1 && (
        <div style={{
          position: 'absolute',
          top: isMobile ? 100 : 80,
          right: 16,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 20,
          padding: '6px 14px',
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
            {photoIndex + 1}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            / {photos.length}
          </Text>
        </div>
      )}

      {/* 顶部信息 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: isMobile ? '40px 16px 16px' : '20px 24px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Button type="text" icon={<LeftOutlined />} onClick={onBack} style={{ color: '#fff', fontSize: 18 }}>返回</Button>

          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            合集 {currentIndex + 1} / {collections.length}
          </Text>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button type={favoriteOnly ? 'primary' : 'default'} size="small" ghost={!favoriteOnly}
              onClick={() => setFavoriteOnly(prev => !prev)}
              style={{ borderRadius: 20, fontSize: 12, color: favoriteOnly ? '#ff4d4f' : '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
              {favoriteOnly ? '❤️ 收藏' : '收藏'}
            </Button>
            <Button size="small" ghost onClick={handleGenerate} loading={generating}
              style={{ borderRadius: 20, fontSize: 12, color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
              刷新
            </Button>
          </div>
        </div>

        <Text style={{ color: '#fff', fontSize: 22, fontWeight: 700, display: 'block', textShadow: '0 2px 8px rgba(0,0,0,0.5)', lineHeight: 1.3 }}>
          {currentCollection.title}
        </Text>

        {currentCollection.tags && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {currentCollection.tags.split(' ').filter(Boolean).slice(0, 5).map((tag, i) => (
              <span key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 12 }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 底部进度条（独立层，始终在最底部可见） */}
      {photos.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? 72 : 32,
          left: 0, right: 0,
          display: 'flex',
          gap: 4,
          justifyContent: 'center',
          alignItems: 'center',
          padding: '6px 0',
          zIndex: 15,
        }}>
          {photos.slice(0, Math.min(photos.length, 15)).map((_, i) => (
            <div key={i} style={{
              flex: 1,
              maxWidth: 28,
              height: i === photoIndex ? 4 : 3,
              borderRadius: 3,
              background: i === photoIndex ? '#fff' : 'rgba(255,255,255,0.35)',
              transition: 'all 0.3s ease',
              boxShadow: i === photoIndex ? '0 0 6px rgba(255,255,255,0.4)' : 'none',
            }} />
          ))}
          {photos.length > 15 && (
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 2 }}>+{photos.length - 15}</Text>
          )}
        </div>
      )}

      {/* 底部文案 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: isMobile ? '100px 16px 72px' : '80px 24px 56px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 1.6, display: 'block', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
          {currentCollection.description}
        </Text>
      </div>

      {/* 右侧收藏 */}
      <div style={{ position: 'absolute', right: 16, bottom: isMobile ? 160 : 100, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
        <Button type="text"
          icon={isFav ? <HeartFilled style={{ color: '#ff4d4f', fontSize: 28 }} /> : <HeartOutlined style={{ color: '#fff', fontSize: 28 }} />}
          onClick={handleFavorite}
          style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }} />
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>{isFav ? '已收藏' : '收藏'}</Text>
      </div>
    </div>
  );
}
