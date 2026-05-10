import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, message, Typography } from 'antd';
import { HeartOutlined, HeartFilled } from '@ant-design/icons';
import { generateCollections, refreshCollectionMeta, fetchCollections, toggleCollectionFavorite, getProxyUrl, clearAllCollections } from '../api/imageApi';
import { fetchSettings } from '../api/imageApi';
import BgmPlayer from '../components/bgm/BgmPlayer';

const { Text } = Typography;
const PLACEHOLDER = '⏳ 生成中...';

import CollectionLoading from '../components/collection/CollectionLoading';
import CollectionHeader from '../components/collection/CollectionHeader';
import CollectionFooter from '../components/collection/CollectionFooter';
import CollectionSlide from '../components/collection/CollectionSlide';

export default function CollectionPage({ isMobile, onNavigate }) {
  const [collections, setCollections] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [llmModel, setLlmModel] = useState('');

  // 滑动动画状态（合集）
  const [slideY, setSlideY] = useState(0);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [sliding, setSliding] = useState(false);

  // 滑动动画状态（照片左右切）
  const [slideX, setSlideX] = useState(0);
  const [pendingPhotoIdx, setPendingPhotoIdx] = useState(null);
  const [photoSliding, setPhotoSliding] = useState(false);
  const autoPlayRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const initializedRef = useRef(false);
  const pollRef = useRef(null);
  const pendingRefreshRef = useRef(new Set());
  const llmModelRef = useRef('');
  const currentBgmTrackRef = useRef('');
  const savedAllIndexRef = useRef(0);

  // 在「全部」模式下跟踪当前位置，切换回来时恢复
  useEffect(() => {
    if (!favoriteOnly && collections.length > 0) {
      savedAllIndexRef.current = currentIndex;
    }
  }, [currentIndex, favoriteOnly, collections.length]);

  // 加载设定
  useEffect(() => {
    fetchSettings()
      .then(data => { if (data.caption_llm_model) setLlmModel(data.caption_llm_model); })
      .catch(() => {});
  }, []);

  // llmModel 同步到 ref
  useEffect(() => { llmModelRef.current = llmModel; }, [llmModel]);

  // 检查是否有合集还在"生成中"，有则轮询
  const hasPlaceholder = useCallback((cols) => {
    return cols.some(c => c.title === PLACEHOLDER);
  }, []);

  // 刷新合集列表（用于轮询）
  const refreshFromServer = useCallback(async () => {
    try {
      const data = await fetchCollections(1, 50, favoriteOnly);
      if (data.collections) {
        setCollections(data.collections);
        return data.collections;
      }
    } catch (e) { /* ignore */ }
    return null;
  }, [favoriteOnly]);

  // 轮询效果：当有合集仍在"生成中"时，每3秒刷新
  useEffect(() => {
    if (collections.length > 0 && hasPlaceholder(collections)) {
      pollRef.current = setInterval(async () => {
        const updated = await refreshFromServer();
        if (updated && !hasPlaceholder(updated)) {
          clearInterval(pollRef.current);
        }
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [collections, hasPlaceholder, refreshFromServer]);

  // 生成合集
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setLoading(true);
    try {
      await clearAllCollections();
      const data = await generateCollections(20, llmModel);
      if (data.success && data.collections && data.collections.length > 0) {
        setCollections(data.collections);
        setCurrentIndex(0);
        setPhotoIndex(0);
        message.success(`生成了 ${data.collections.length} 个合集（文案生成中...）`);

        // 重置防重复标记
        pendingRefreshRef.current = new Set();

        // 自动刷新前 5 个合集的文案（并发）
        const firstIds = data.collections.slice(0, 5).map(c => c.id);
        firstIds.forEach(id => pendingRefreshRef.current.add(id));
        refreshCollectionMeta(firstIds, llmModel).then(res => {
          if (res.success && res.updated?.length > 0) {
            // 文案刷新后，从服务端拉最新数据
            refreshFromServer();
          }
        }).catch(() => {});
      } else {
        message.error('生成失败');
      }
    } catch (err) {
      console.error(err);
      message.error('生成请求失败');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  }, [llmModel]);

  // 首次进入：优先加载已有合集，为空才生成
  useEffect(() => {
    if (!initializedRef.current && !favoriteOnly) {
      initializedRef.current = true;
      setLoading(true);
      fetchCollections(1, 50, false).then(data => {
        if (data.collections && data.collections.length > 0) {
          setCollections(data.collections);
          setCurrentIndex(0);
          setPhotoIndex(0);
          setLoading(false);
          // 刷新未完成的合集文案
          const todoIds = data.collections
            .filter(c => c.title === PLACEHOLDER && !pendingRefreshRef.current.has(c.id))
            .map(c => c.id);
          if (todoIds.length > 0) {
            todoIds.forEach(id => pendingRefreshRef.current.add(id));
            refreshCollectionMeta(todoIds, llmModel).then(res => {
              if (res.success && res.updated?.length > 0) refreshFromServer();
            }).catch(() => {});
          }
        } else {
          handleGenerate();
        }
      }).catch(() => { setLoading(false); });
    }
  }, [favoriteOnly, handleGenerate]);

  // 收藏模式下加载 / 切回全部
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
    } else {
      // 切回全部：恢复到之前在全部列表的位置
      refreshFromServer().then(() => {
        setCurrentIndex(savedAllIndexRef.current);
      });
    }
  }, [favoriteOnly]);

  // ============ 预加载：刷到第N个合集时，提前生成 N+1~N+4 的文案 ============
  useEffect(() => {
    if (collections.length === 0 || generating) return;

    // 找当前合集往后 4 个需要刷新的
    const aheadIds = [];
    for (let i = currentIndex + 1; i <= Math.min(currentIndex + 4, collections.length - 1); i++) {
      const col = collections[i];
      if (!col) continue;
      if (col.title === PLACEHOLDER && !pendingRefreshRef.current.has(col.id)) {
        aheadIds.push(col.id);
      }
    }

    if (aheadIds.length === 0) return;

    // 标记为已提交，防重复
    aheadIds.forEach(id => pendingRefreshRef.current.add(id));

    const model = llmModelRef.current;
    refreshCollectionMeta(aheadIds, model).then(res => {
      if (res.success && res.updated?.length > 0) {
        refreshFromServer();
      }
    }).catch(() => {
      aheadIds.forEach(id => pendingRefreshRef.current.delete(id));
    });
  }, [currentIndex, collections, generating]);

  // 自动轮播
  useEffect(() => {
    if (autoPlay && !photoSliding && collections.length > 0 && collections[currentIndex]) {
      const photos = collections[currentIndex].photo_paths || [];
      if (photos.length <= 1) return;
      autoPlayRef.current = setInterval(() => {
        setPhotoIndex(prev => (prev + 1) % photos.length);
      }, 3000);
    }
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [autoPlay, currentIndex, collections]);

  // 切换合集（带滑动动画）
  const goToPrevCollection = useCallback(() => {
    if (sliding || currentIndex <= 0) return;
    setPendingIndex(currentIndex - 1);
    setSliding(true);
    setSlideY(100); // current slides DOWN, prev appears above
  }, [currentIndex, sliding]);

  const goToNextCollection = useCallback(() => {
    if (sliding || currentIndex >= collections.length - 1) return;
    setPendingIndex(currentIndex + 1);
    setSliding(true);
    setSlideY(-100); // current slides UP, next appears below
  }, [currentIndex, collections.length, sliding]);

  // 滑动结束
  const onSlideEnd = useCallback(() => {
    if (pendingIndex !== null && slideY !== 0) {
      setCurrentIndex(pendingIndex);
      setPhotoIndex(0);
    }
    setSlideY(0);
    setPendingIndex(null);
    setSliding(false);
  }, [pendingIndex, slideY]);

  const nextPhoto = useCallback(() => {
    const p = collections[currentIndex]?.photo_paths || [];
    if (photoSliding || sliding || p.length <= 1) return;
    const next = (photoIndex + 1) % p.length;
    const url = getProxyUrl(p[next]);
    // 预加载，避免黑屏
    const img = new Image();
    img.onload = img.onerror = () => {
      setPendingPhotoIdx(next);
      setPhotoSliding(true);
      setSlideX(-100);
    };
    img.src = url;
    setAutoPlay(false);
    setTimeout(() => setAutoPlay(true), 5000);
  }, [currentIndex, collections, photoIndex, photoSliding, sliding]);

  const prevPhoto = useCallback(() => {
    const p = collections[currentIndex]?.photo_paths || [];
    if (photoSliding || sliding || p.length <= 1) return;
    const prev = (photoIndex - 1 + p.length) % p.length;
    const url = getProxyUrl(p[prev]);
    const img = new Image();
    img.onload = img.onerror = () => {
      setPendingPhotoIdx(prev);
      setPhotoSliding(true);
      setSlideX(100);
    };
    img.src = url;
    setAutoPlay(false);
    setTimeout(() => setAutoPlay(true), 5000);
  }, [currentIndex, collections, photoIndex, photoSliding, sliding]);

  // 照片滑动结束
  const onPhotoSlideEnd = useCallback(() => {
    if (pendingPhotoIdx !== null && slideX !== 0) {
      setPhotoIndex(pendingPhotoIdx);
    }
    setSlideX(0);
    setPendingPhotoIdx(null);
    setPhotoSliding(false);
  }, [pendingPhotoIdx, slideX]);

  // 被动预加载：photoIndex 变化时提前缓存相邻照片
  useEffect(() => {
    const p = (collections[currentIndex]?.photo_paths || []);
    if (p.length <= 1) return;
    const nextIdx = (photoIndex + 1) % p.length;
    const prevIdx = (photoIndex - 1 + p.length) % p.length;
    [prevIdx, nextIdx].forEach(idx => {
      const img = new Image();
      img.src = getProxyUrl(p[idx]);
    });
  }, [photoIndex, currentIndex, collections]);

  const handleFavorite = async (e) => {
    e.stopPropagation();
    const col = collections[currentIndex];
    if (!col) return;
    const bgmTrack = currentBgmTrackRef.current;
    const data = await toggleCollectionFavorite(col.id, bgmTrack);
    if (data.success) {
      const newCols = [...collections];
      newCols[currentIndex] = { ...newCols[currentIndex], is_favorite: data.is_favorite, bgm_track: bgmTrack };
      setCollections(newCols);
      message.success(data.is_favorite ? '已收藏' : '已取消收藏');
    }
  };

  // BGM 回调
  const handleBgmTrackChange = useCallback((trackName) => {
    currentBgmTrackRef.current = trackName;
  }, []);

  // 触摸
  const handleTouchStart = (e) => { if (sliding) return; touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (e) => {
    if (sliding) return;
    const endX = e.changedTouches[0].clientX, endY = e.changedTouches[0].clientY;
    const dx = endX - touchStartRef.current.x, dy = endY - touchStartRef.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 50) return;
    if (Math.abs(dy) > Math.abs(dx)) { dy < 0 ? goToNextCollection() : goToPrevCollection(); }
    else { dx < 0 ? nextPhoto() : prevPhoto(); }
  };
  const handleWheel = (e) => {
    if (sliding) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { e.deltaX > 0 ? nextPhoto() : prevPhoto(); }
    else { e.deltaY > 0 ? goToNextCollection() : goToPrevCollection(); }
  };
  useEffect(() => {
    const h = (e) => {
      if (sliding) return;
      switch (e.key) {
        case 'ArrowDown': goToNextCollection(); break;
        case 'ArrowUp': goToPrevCollection(); break;
        case 'ArrowRight': nextPhoto(); break;
        case 'ArrowLeft': prevPhoto(); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goToNextCollection, goToPrevCollection, nextPhoto, prevPhoto, sliding]);

  // ==== 渲染 ====

  // 加载/空状态
  if (loading && collections.length === 0) {
    return <CollectionLoading loading={true} collections={collections} generating={generating} isMobile={isMobile} favoriteOnly={favoriteOnly} setFavoriteOnly={setFavoriteOnly} handleGenerate={handleGenerate} />;
  }

  if (collections.length === 0 && !generating) {
    return <CollectionLoading loading={false} collections={collections} generating={generating} isMobile={isMobile} favoriteOnly={favoriteOnly} setFavoriteOnly={setFavoriteOnly} handleGenerate={handleGenerate} />;
  }

  const currentCollection = collections[currentIndex];
  if (!currentCollection) {
    return (
      <div style={{ width: '100%', height: isMobile ? '100dvh' : '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff', paddingTop: 'env(safe-area-inset-top)' }}>
        <Text>没有更多合集了</Text>
        <Button type="link" onClick={handleGenerate}>生成新合集</Button>
      </div>
    );
  }

  const photos = currentCollection.photo_paths || [];
  const currentPhoto = photos[photoIndex];
  const isFav = currentCollection.is_favorite;

  return (
    <div ref={containerRef} className={'collection-page' + (fullscreen ? ' collection-fullscreen' : '')}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onWheel={handleWheel}
      style={{ width: '100%', height: '100%', background: '#000', position: 'relative', overflow: 'hidden', userSelect: 'none', paddingTop: 'env(safe-area-inset-top)' }}>

      {/* 背景层：下一个/上一个合集的照片（滑动时露出） */}
      {sliding && pendingIndex !== null && collections[pendingIndex] && (() => {
        const pc = collections[pendingIndex];
        const pp = (pc.photo_paths || [])[0];
        return (
          <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
            {pp && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                background: `center/cover no-repeat url('${getProxyUrl(pp)}')`,
                filter: 'blur(20px)', opacity: 0.5, transform: 'scale(1.1)',
              }} />
            )}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pp ? (
                <img src={getProxyUrl(pp)} alt="" draggable={false}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4, boxShadow: '0 4px 30px rgba(0,0,0,0.5)' }} />
              ) : (
                <Text style={{ color: '#666' }}>图片加载失败</Text>
              )}
            </div>
          </div>
        );
      })()}

      {/* 当前层（滑动出/入） */}
      <div
        onTransitionEnd={onSlideEnd}
        style={{
          position: 'absolute', inset: 0, zIndex: 2,
          transform: `translateY(${slideY}vh)`,
          transition: sliding ? 'transform 0.35s cubic-bezier(0.22, 0.28, 0.17, 1)' : 'none',
        }}
      >

      {/* 当前照片层（滑动出/入） */}
      <div
        onTransitionEnd={onPhotoSlideEnd}
        style={{
          position: 'absolute', inset: 0, zIndex: 2,
          transform: `translateX(${slideX}vw)`,
          transition: photoSliding ? 'transform 0.35s cubic-bezier(0.22, 0.28, 0.17, 1)' : 'none',
        }}
      >
        <CollectionSlide
          currentPhoto={currentPhoto}
          photoIndex={photoIndex}
          photos={photos}
          getProxyUrl={getProxyUrl}
        />
      </div>

      <CollectionHeader
        isMobile={isMobile}
        currentIndex={currentIndex}
        collections={collections}
        favoriteOnly={favoriteOnly}
        setFavoriteOnly={setFavoriteOnly}
        handleGenerate={handleGenerate}
        generating={generating}
        onBack={() => onNavigate('browse')}
        currentCollection={currentCollection}
        savedAllIndexRef={savedAllIndexRef}
      />

      <CollectionFooter
        currentCollection={currentCollection}
        photoIndex={photoIndex}
        photos={photos}
        isMobile={isMobile}
      />

      {/* 全屏切换按钮 */}
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 30 }}>
        <Button type="text"
          icon={fullscreen
            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/></svg>
            : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
          }
          onClick={() => setFullscreen(!fullscreen)}
          style={{ width: 44, height: 44, background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}
        />
      </div>

      {/* BGM 播放器 */}
      <BgmPlayer key={currentCollection.id} collection={currentCollection} visible={!generating && collections.length > 0} onTrackChange={handleBgmTrackChange} isMobile={isMobile} />

      {/* 收藏 */}
      <div style={{ position: 'absolute', right: 16, bottom: `calc(${isMobile ? 200 : 180}px + env(safe-area-inset-bottom, 0px))`, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 }}>
        <Button type="text"
          icon={isFav ? <HeartFilled style={{ color: '#ff4d4f', fontSize: 28 }} /> : <HeartOutlined style={{ color: '#fff', fontSize: 28 }} />}
          onClick={handleFavorite}
          style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }} />
        <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>{isFav ? '已收藏' : '收藏'}</Text>
      </div>
      </div>
    </div>
  );
}
