import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, message, Spin, Typography, Empty } from 'antd';
import { HeartOutlined, HeartFilled, LoadingOutlined, LeftOutlined } from '@ant-design/icons';
import { generateCollections, refreshCollectionMeta, fetchCollections, toggleCollectionFavorite, getProxyUrl, clearAllCollections } from '../api/imageApi';
import { fetchSettings } from '../api/imageApi';
import BgmPlayer from '../components/bgm/BgmPlayer';

const { Text } = Typography;
const PLACEHOLDER = '⏳ 生成中...';

export default function CollectionPage({ isMobile, onBack }) {
  const [collections, setCollections] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [llmModel, setLlmModel] = useState('');

  // 滑动动画状态
  const [slideY, setSlideY] = useState(0);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [sliding, setSliding] = useState(false);
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
    if (autoPlay && collections.length > 0 && collections[currentIndex]) {
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
    const photos = collections[currentIndex]?.photo_paths || [];
    if (photos.length > 1) { setPhotoIndex(prev => (prev + 1) % photos.length); setAutoPlay(false); setTimeout(() => setAutoPlay(true), 5000); }
  }, [currentIndex, collections]);
  const prevPhoto = useCallback(() => {
    const photos = collections[currentIndex]?.photo_paths || [];
    if (photos.length > 1) { setPhotoIndex(prev => (prev - 1 + photos.length) % photos.length); setAutoPlay(false); setTimeout(() => setAutoPlay(true), 5000); }
  }, [currentIndex, collections]);

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
  const isPlaceholder = currentCollection.title === PLACEHOLDER;

  return (
    <div ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onWheel={handleWheel}
      style={{ width: '100%', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden', userSelect: 'none' }}>

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
        <div style={{ position: 'absolute', top: isMobile ? 100 : 80, right: 16, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', borderRadius: 20, padding: '6px 14px', zIndex: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{photoIndex + 1}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>/ {photos.length}</Text>
        </div>
      )}

      {/* 顶部 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: isMobile ? '40px 16px 16px' : '20px 24px', background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)', zIndex: 10 }}>
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
          ) : currentCollection.title}
        </Text>

        {currentCollection.tags && !isPlaceholder && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {currentCollection.tags.split(' ').filter(Boolean).slice(0, 5).map((tag, i) => (
              <span key={i} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, background: 'rgba(255,255,255,0.15)', padding: '2px 10px', borderRadius: 12 }}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* 底部文案（恢复第一版样式） */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? 80 : 40,
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
          {isPlaceholder ? '正在生成文案...' : currentCollection.description}
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

      {/* BGM 播放器 */}
      <BgmPlayer key={currentCollection.id} collection={currentCollection} visible={!generating && collections.length > 0} onTrackChange={handleBgmTrackChange} isMobile={isMobile} />

      {/* 收藏 */}
      <div style={{ position: 'absolute', right: 16, bottom: isMobile ? 200 : 180, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20 }}>
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
