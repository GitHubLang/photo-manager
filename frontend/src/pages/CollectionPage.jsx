import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, message, Spin, Typography, Empty, Tag } from 'antd';
import { HeartOutlined, HeartFilled, LoadingOutlined, LeftOutlined } from '@ant-design/icons';
import { generateCollections, fetchCollections, toggleCollectionFavorite, getProxyUrl } from '../api/imageApi';
import { fetchSettings, saveSettings } from '../api/imageApi';

const { Text } = Typography;

/**
 * 抖音图集风格照片合集页面
 * - 竖向滑动切换合集（上滑下一个 / 下滑上一个）
 * - 横向滑动切换合集内照片
 * - 自动轮播
 * - 收藏功能
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
  const touchEndRef = useRef({ x: 0, y: 0 });

  // 加载设置中的 LLM 模型
  useEffect(() => {
    fetchSettings()
      .then(data => {
        if (data.caption_llm_model) setLlmModel(data.caption_llm_model);
      })
      .catch(() => {});
  }, []);

  // 加载合集
  const loadCollections = useCallback(async (favOnly = false) => {
    setLoading(true);
    try {
      const data = await fetchCollections(1, 50, favOnly);
      if (data.collections && data.collections.length > 0) {
        setCollections(data.collections);
        setCurrentIndex(0);
        setPhotoIndex(0);
      } else if (data.total === 0 && !favOnly) {
        // 如果没有合集，自动生成一批
        handleGenerate();
        return;
      } else {
        setCollections([]);
      }
    } catch (err) {
      console.error('加载合集失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollections(favoriteOnly);
  }, [favoriteOnly]);

  // 生成合集
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateCollections(20, llmModel);
      if (data.success && data.collections) {
        setCollections(data.collections);
        setCurrentIndex(0);
        setPhotoIndex(0);
        message.success(`生成了 ${data.count} 个合集`);
      } else {
        message.error('生成失败');
      }
    } catch (err) {
      message.error('生成请求失败');
    } finally {
      setGenerating(false);
    }
  };

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

  // 处理收藏
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

    // 最小滑动距离
    if (Math.max(absX, absY) < 50) return;

    if (absY > absX) {
      // 竖向滑动：切换合集
      if (deltaY < 0) {
        // 向上滑 → 下一个合集
        goToNextCollection();
      } else {
        // 向下滑 → 上一个合集
        goToPrevCollection();
      }
    } else {
      // 横向滑动：切换照片
      if (deltaX < 0) {
        nextPhoto();
      } else {
        prevPhoto();
      }
    }
  };

  // 鼠标滚轮
  const handleWheel = (e) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // 横向滚轮：切换照片
      if (e.deltaX > 0) nextPhoto();
      else prevPhoto();
    } else {
      // 竖向滚轮：切换合集
      if (e.deltaY > 0) goToNextCollection();
      else goToPrevCollection();
    }
  };

  // 键盘
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

  // 显示加载状态
  if (loading) {
    return (
      <div style={{
        width: '100%', height: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#000',
        color: '#fff',
      }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36, color: '#fff' }} spin />} />
        <Text style={{ color: '#999', marginTop: 16 }}>加载合集中...</Text>
      </div>
    );
  }

  // 空状态（没有合集也没生成）
  if (collections.length === 0 && !generating) {
    return (
      <div style={{
        width: '100%', height: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#000',
        color: '#fff',
      }}>
        <Empty description={<Text style={{ color: '#999' }}>还没有照片合集</Text>} />
        <Button
          type="primary"
          size="large"
          onClick={handleGenerate}
          loading={generating}
          style={{ marginTop: 20, borderRadius: 24, padding: '8px 32px' }}
        >
          生成合集
        </Button>
      </div>
    );
  }

  const currentCollection = collections[currentIndex];
  if (!currentCollection) {
    return (
      <div style={{
        width: '100%', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000', color: '#fff',
      }}>
        <Text>没有更多合集了</Text>
        <Button type="link" onClick={handleGenerate}>生成新合集</Button>
      </div>
    );
  }

  const photos = currentCollection.photo_paths || [];
  const currentPhoto = photos[photoIndex];
  const isFav = currentCollection.is_favorite;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100vh',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* 背景图（当前照片） */}
      {currentPhoto && (
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `center/cover no-repeat url('${getProxyUrl(currentPhoto)}')`,
            filter: 'blur(20px)',
            opacity: 0.5,
            transform: 'scale(1.1)',
          }}
        />
      )}

      {/* 主图 */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {currentPhoto ? (
          <img
            src={getProxyUrl(currentPhoto)}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 4,
              boxShadow: '0 4px 30px rgba(0,0,0,0.5)',
            }}
            draggable={false}
          />
        ) : (
          <Text style={{ color: '#666' }}>图片加载失败</Text>
        )}
      </div>

      {/* 顶部信息 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        padding: isMobile ? '40px 16px 16px' : '20px 24px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        zIndex: 10,
      }}>
        {/* 导航行 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <Button
            type="text"
            icon={<LeftOutlined />}
            onClick={onBack}
            style={{ color: '#fff', fontSize: 18 }}
          >
            返回
          </Button>

          {/* 合集指示器 */}
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            {currentIndex + 1} / {collections.length}
          </Text>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={favoriteOnly ? 'primary' : 'default'}
              size="small"
              ghost={!favoriteOnly}
              onClick={() => setFavoriteOnly(prev => !prev)}
              style={{
                borderRadius: 20,
                fontSize: 12,
                color: favoriteOnly ? '#ff4d4f' : '#fff',
                borderColor: 'rgba(255,255,255,0.4)',
              }}
            >
              {favoriteOnly ? '❤️ 收藏' : '收藏'}
            </Button>
            <Button
              size="small"
              ghost
              onClick={handleGenerate}
              loading={generating}
              style={{
                borderRadius: 20,
                fontSize: 12,
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.4)',
              }}
            >
              刷新
            </Button>
          </div>
        </div>

        {/* 标题 */}
        <Text style={{
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          display: 'block',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          lineHeight: 1.3,
        }}>
          {currentCollection.title}
        </Text>

        {/* tags */}
        {currentCollection.tags && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {currentCollection.tags.split(' ').filter(Boolean).slice(0, 5).map((tag, i) => (
              <span key={i} style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 12,
                background: 'rgba(255,255,255,0.15)',
                padding: '2px 10px',
                borderRadius: 12,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 底部文案 */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? 80 : 40,
        left: 0, right: 0,
        padding: '32px 16px 16px',
        background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        zIndex: 10,
      }}>
        <Text style={{
          color: 'rgba(255,255,255,0.85)',
          fontSize: 14,
          lineHeight: 1.5,
          display: 'block',
          textShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }}>
          {currentCollection.description}
        </Text>

        {/* 照片进度指示器 */}
        {photos.length > 1 && (
          <div style={{
            display: 'flex',
            gap: 3,
            marginTop: 10,
            justifyContent: 'center',
          }}>
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
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 4 }}>
                +{photos.length - 12}
              </Text>
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

      {/* 右侧收藏按钮 */}
      <div style={{
        position: 'absolute',
        right: 16,
        bottom: isMobile ? 160 : 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
      }}>
        <Button
          type="text"
          icon={isFav ? <HeartFilled style={{ color: '#ff4d4f', fontSize: 28 }} /> 
                       : <HeartOutlined style={{ color: '#fff', fontSize: 28 }} />}
          onClick={handleFavorite}
          style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}
        />
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>
          {isFav ? '已收藏' : '收藏'}
        </Text>
      </div>

      {/* 方向提示 */}
      {currentIndex === 0 && currentCollection && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? 140 : 90,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'swipeHint 2s infinite',
          opacity: 0.5,
          zIndex: 5,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, marginBottom: 4 }}>
            ⟵ 滑照片 · 上下滑切换合集 ⟶
          </Text>
        </div>
      )}
    </div>
  );
}
