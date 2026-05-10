import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Slider } from 'antd';
import {
  PlayCircleOutlined, PauseCircleOutlined,
  StepForwardOutlined, StepBackwardOutlined,
  SoundOutlined, MutedOutlined,
} from '@ant-design/icons';

// ============ mood 检测 ============
const MOOD_KEYWORDS = {
  cinematic: [
    'epic', 'mountain', 'grand', 'vast', 'sky', 'ocean', 'sunrise', 'dawn',
    '冒险', '宏大', '山川', '海洋', '日出', '晨光', '雄伟', '壮丽',
    'landscape', 'horizon', 'storm',
  ],
  lofi: [
    'coffee', 'lazy', 'street', 'urban', 'vintage', 'casual', 'rainy',
    '咖啡', '慵懒', '街头', '怀旧', '随性', '下雨', '雨天', '文艺',
    'alley', 'cafe', 'neon', 'graffiti',
  ],
  upbeat: [
    'joy', 'party', 'playful', 'fun', 'colorful', 'food', 'festival',
    '欢乐', '派对', '快乐', '彩色', '美食', '节日', '热闹', '阳光',
    'celebration', 'happy', 'lively', 'summer', 'beach',
  ],
  calm: [
    'serene', 'peaceful', 'lake', 'sunset', 'natural', 'garden',
    '宁静', '平静', '湖泊', '日落', '自然', '花园', '傍晚', '田园',
    'zen', 'meditation', 'park', 'waterfall', 'stream',
  ],
  ambient: [
    'night', 'mist', 'fog', 'dusk', 'dark', 'moon', 'star',
    '夜晚', '雾', '黄昏', '黑暗', '月亮', '星空', '幽静', '朦胧',
    'silence', 'lonely', 'desert', 'snow', 'winter',
  ],
};

function detectMood(title, tags) {
  const text = ((title || '') + ' ' + (tags || '')).toLowerCase();
  const scores = {};
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    scores[mood] = keywords.filter(kw => text.includes(kw)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'calm';
}

// ============ 组件 ============
export default function BgmPlayer({ collection, visible = true, onTrackChange, isMobile }) {
  const audioRef = useRef(null);
  const manifestRef = useRef(null);
  const moodRef = useRef('calm');
  const collectionTitleRef = useRef('');
  const collectionTagsRef = useRef('');
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [trackIndex, setTrackIndex] = useState(0);
  const [tracks, setTracks] = useState([]);
  const [source, setSource] = useState(null);
  const trackRef = useRef(null);

  // 当 tracks 或 trackIndex 变化时通知父组件
  const getTrackLabel = useCallback(() => {
    const t = tracks[trackIndex];
    return t ? (t.artist ? `${t.artist} - ${t.title}` : t.title) : '';
  }, [tracks, trackIndex]);

  useEffect(() => {
    const label = getTrackLabel();
    if (onTrackChange && label) onTrackChange(label);
  }, [trackIndex, tracks, onTrackChange, getTrackLabel]);

  // 初始化音频
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = false;
      audioRef.current.volume = volume;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // volume 同步
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  // 加载曲库（一次性）
  useEffect(() => {
    (async () => {
      // 先试本地音乐
      try {
        const r = await fetch('/api/bgm/local');
        if (r.ok) {
          const data = await r.json();
          if (data.enabled && data.tracks?.length > 0) {
            const allTracks = data.tracks.map(t => ({
              title: t.title,
              artist: t.artist || '',
              filename: t.filename,
              url: data.proxy_prefix + t.filename,
            }));
            setSource('local');
            setTracks(allTracks);
            setTrackIndex(Math.floor(Math.random() * allTracks.length));
            setReady(true);
            return;
          }
        }
      } catch { /* fall through */ }

      // 回退预置曲库
      try {
        const r = await fetch('/bgm/manifest.json');
        if (r.ok) {
          const manifest = await r.json();
          manifestRef.current = manifest;
          setSource('preinstalled');
          setReady(true);
          // tracks 为空，等 collection 变化时通过 mood 匹配决定
        }
      } catch { /* no bgm */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 合集变化 → 重新选曲（用 id 做稳定对比，避免切照片也触发）
  useEffect(() => {
    if (!ready || !collection || source !== 'preinstalled') return;
    const manifest = manifestRef.current;
    if (!manifest) return;

    const mood = detectMood(collection.title, collection.tags);
    const moodTracks = manifest[mood];
    const pool = moodTracks?.length > 0 ? moodTracks : Object.values(manifest).flat();
    if (pool.length === 0) return;

    moodRef.current = mood;
    collectionTitleRef.current = collection.title;
    collectionTagsRef.current = collection.tags;
    setTracks(pool);
    setTrackIndex(Math.floor(Math.random() * pool.length));
  }, [ready, collection?.id, source]);

  // trackIndex 变化 → 播放
  const playTrack = useCallback((idx) => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0 || idx < 0 || idx >= tracks.length) return;

    const t = tracks[idx];
    let url;
    if (source === 'local') {
      url = t.url;
    } else {
      // preinstalled — 用缓存的 mood 查子目录
      const mood = moodRef.current;
      url = `/bgm/${mood}/${encodeURIComponent(t.filename)}`;
    }

    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    audio.play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
      });
  }, [tracks, source]);

  // 播放下一曲（自动切换）
  const advanceTrack = useCallback(() => {
    setTrackIndex(prev => (prev + 1) % tracks.length);
  }, [tracks.length]);

  // trackIndex 变化时播放
  useEffect(() => {
    playTrack(trackIndex);
  }, [trackIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动播下一首
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => advanceTrack();
    audio.addEventListener('ended', handler);
    return () => audio.removeEventListener('ended', handler);
  }, [advanceTrack]);

  // ============ 控制 ============
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      if (audio.src) {
        audio.play().then(() => setPlaying(true)).catch(() => {});
      } else if (tracks.length > 0) {
        playTrack(trackIndex);
      }
    }
  }, [playing, tracks, trackIndex, playTrack]);

  const nextTrack = useCallback(() => advanceTrack(), [advanceTrack]);
  const prevTrack = useCallback(() => {
    setTrackIndex(prev => (prev - 1 + tracks.length) % tracks.length);
  }, [tracks.length]);

  if (!visible || !ready) return null;

  const currentTrack = tracks[trackIndex];
  if (!currentTrack) return null;

  const trackLabel = currentTrack.artist
    ? `${currentTrack.artist} - ${currentTrack.title}`
    : currentTrack.title;

  return (
    <div style={{
      position: 'absolute',
      bottom: isMobile ? 200 : 120,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 25,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: 24,
      padding: '6px 14px 6px 10px',
      border: '1px solid rgba(255,255,255,0.08)',
      maxWidth: 280,
    }}>
      {/* 播放/暂停 */}
      <Button type="text"
        icon={playing ? <PauseCircleOutlined style={{ fontSize: 22, color: '#fff' }} /> : <PlayCircleOutlined style={{ fontSize: 22, color: '#fff' }} />}
        onClick={togglePlay}
        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      />
      <Button type="text" icon={<StepBackwardOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />}
        onClick={prevTrack} style={{ width: 24, height: 24, padding: 0 }} />
      <Button type="text" icon={<StepForwardOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />}
        onClick={nextTrack} style={{ width: 24, height: 24, padding: 0 }} />

      <span style={{
        color: '#fff', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden',
        textOverflow: 'ellipsis', maxWidth: 100, flex: 1,
      }} title={trackLabel}>{trackLabel}</span>

      <Button type="text"
        icon={muted ? <MutedOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }} /> : <SoundOutlined style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }} />}
        onClick={() => setMuted(prev => !prev)}
        style={{ width: 24, height: 24, padding: 0 }} />

      <div className="bgm-volume-hover"
        style={{ width: 0, overflow: 'hidden', transition: 'width 0.2s', display: 'flex', alignItems: 'center' }}>
        <Slider min={0} max={1} step={0.05} value={volume} onChange={setVolume}
          style={{ width: 60, margin: 0 }}
          trackStyle={{ background: 'rgba(255,255,255,0.6)' }}
          railStyle={{ background: 'rgba(255,255,255,0.2)' }}
          handleStyle={{ borderColor: '#fff', background: '#fff', width: 12, height: 12, marginTop: -5 }}
        />
      </div>

      <style>{`
        .bgm-volume-hover:hover {
          width: 72px !important;
          padding-left: 8px;
        }
      `}</style>
    </div>
  );
}
