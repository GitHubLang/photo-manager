import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * 全局应用状态 Context
 * - 选中文件夹、当前图片列表
 * - 选中图片
 * - 评分中状态
 * - 预览状态
 */
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [selectedImages, setSelectedImages] = useState([]);
  const [scoringIds, setScoringIds] = useState(new Set());
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [dailyTheme, setDailyTheme] = useState(null);

  // 图片选择
  const toggleSelectImage = useCallback((img) => {
    setSelectedImages(prev =>
      prev.some(item => (item.id || item) === img.id)
        ? prev.filter(item => (item.id || item) !== img.id)
        : [...prev, img]
    );
  }, []);

  const toggleSelectAll = useCallback((images) => {
    setSelectedImages(prev => prev.length === images.length ? [] : [...images]);
  }, []);

  const isScoring = useCallback((id) => scoringIds.has(id), [scoringIds]);

  const value = {
    selectedImages, setSelectedImages,
    scoringIds, setScoringIds,
    previewVisible, setPreviewVisible,
    selectedImage, setSelectedImage,
    themeModalVisible, setThemeModalVisible,
    dailyTheme, setDailyTheme,
    toggleSelectImage, toggleSelectAll, isScoring,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
