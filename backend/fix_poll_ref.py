#!/usr/bin/env python3
"""用 Python 字节流精确替换，避免 patch 工具 null 字节破坏"""
import re

# ========= 修复 useImages.js =========
useimages_path = r'D:\MySoftware\photo-manager\frontend\src\hooks\useImages.js'
with open(useimages_path, 'r', encoding='utf-8') as f:
    content = f.read()

updateImage_code = '''
  // 更新单张图片数据（评分完成后原地更新，不用重刷列表）
  const updateImage = useCallback((imageId, updatedFields) => {
    setImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, ...updatedFields } : img
    ));
  }, []);

'''

old_loadNextPage = "  // 加载下一页（向下翻页）\n  const loadNextPage = useCallback(() => {"
new_loadNextPage = updateImage_code + "  // 加载下一页（向下翻页）\n  const loadNextPage = useCallback(() => {"
content = content.replace(old_loadNextPage, new_loadNextPage)

old_return = """    handleScanAll,
  };"""
new_return = """    handleScanAll,
    updateImage,
  };"""
content = content.replace(old_return, new_return)

with open(useimages_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("useImages.js patched OK")

# ========= 修复 App.jsx =========
app_path = r'D:\MySoftware\photo-manager\frontend\src\App.jsx'
with open(app_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_hook = """  const imageHook = useImages();
  const searchHook = useSearch({
    onSearchStart: () => {}
  });
  const scoreHook = useScore();"""

new_hook = """  const imageHook = useImages();
  const searchHook = useSearch({
    onSearchStart: () => {}
  });

  // 用 ref 避免闭包陷阱，确保 poll 里能用到最新的 updateImage
  const updateImageRef = useRef(null);
  useEffect(() => {
    updateImageRef.current = imageHook.updateImage;
  });

  const scoreHook = useScore();"""

content = content.replace(old_hook, new_hook)

old_poll = """          const updatedImage = await fetchScoreResults(imageId);
          if (updatedImage && updatedImage.id) {
            // 直接用返回数据原地更新图片，不用重刷整个列表
            imageHook.updateImage(imageId, {
              total_score: updatedImage.total_score,
              impact_score: updatedImage.impact_score,
              composition_score: updatedImage.composition_score,
              sharpness_score: updatedImage.sharpness_score,
              exposure_score: updatedImage.exposure_score,
              color_score: updatedImage.color_score,
              uniqueness_score: updatedImage.uniqueness_score,
              description: updatedImage.description,
              tags: updatedImage.tags,
            });
          }
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
          return;
        } else if (status.status === 'failed') {
          scoreHook.addFailedScore(imageId, status.error_message || '评分失败');
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
          return;
        }
        setTimeout(poll, 10000);"""

new_poll = """          const updatedImage = await fetchScoreResults(imageId);
          if (updatedImage && updatedImage.id) {
            // 直接用返回数据原地更新图片，不用重刷整个列表
            updateImageRef.current && updateImageRef.current(imageId, {
              total_score: updatedImage.total_score,
              impact_score: updatedImage.impact_score,
              composition_score: updatedImage.composition_score,
              sharpness_score: updatedImage.sharpness_score,
              exposure_score: updatedImage.exposure_score,
              color_score: updatedImage.color_score,
              uniqueness_score: updatedImage.uniqueness_score,
              description: updatedImage.description,
              tags: updatedImage.tags,
            });
          }
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
          return;
        } else if (status.status === 'failed') {
          scoreHook.addFailedScore(imageId, status.error_message || '评分失败');
          setScoringIds(prev => { const s = new Set(prev); s.delete(imageId); return s; });
          return;
        }
        setTimeout(poll, 10000);"""

content = content.replace(old_poll, new_poll)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("App.jsx patched OK")

# 验证
for p in [useimages_path, app_path]:
    with open(p, 'rb') as f:
        data = f.read()
    nulls = data.count(b'\x00')
    name = p.split('\\')[-1]
    print(name + ": " + str(nulls) + " null bytes, " + str(len(data)) + " bytes")
