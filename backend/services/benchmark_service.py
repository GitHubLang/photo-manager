"""
评分测试服务 — 多种方案对比
"""
import os
import time
import cv2
import numpy as np
from PIL import Image
from pathlib import Path

PHOTO_ROOT = r"E:\图像"


# ============================================================
# OpenCV 技术检测 — 纯本地、毫秒级
# ============================================================

def opencv_technical(image_path: str) -> dict:
    """OpenCV 技术质量检测：清晰度、曝光、对比度"""
    start = time.time()
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        return {'score': 0, 'time': round(time.time() - start, 3), 'details': '无法读取图片'}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 清晰度: Laplacian 方差
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    sharpness = min(100, max(0, laplacian_var / 5))

    # 曝光: 直方图暗部/亮部占比
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    total = np.sum(hist) + 1e-6
    dark_ratio = np.sum(hist[:30]) / total
    bright_ratio = np.sum(hist[225:]) / total
    exposure = 100 - min(100, (dark_ratio + bright_ratio) * 100)

    # 对比度: 灰度标准差
    contrast = min(100, max(0, gray.std() / 2))

    # 综合分 (加权)
    score = sharpness * 0.4 + exposure * 0.3 + contrast * 0.3

    return {
        'score': round(score, 1),
        'time': round(time.time() - start, 3),
        'details': {
            '清晰度': round(sharpness, 1),
            '曝光': round(exposure, 1),
            '对比度': round(contrast, 1),
        }
    }


# ============================================================
# CLIP + LAION Aesthetic — 需要 transformers
# ============================================================

_clip_pipeline = None

def _lazy_load_clip():
    global _clip_pipeline
    if _clip_pipeline is not None:
        return
    import torch
    from transformers import CLIPProcessor, CLIPModel
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = CLIPModel.from_pretrained('openai/clip-vit-large-patch14')
    processor = CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14')
    model.to(device).eval()
    _clip_pipeline = {'model': model, 'processor': processor, 'device': device}


def clip_aesthetic(image_path: str) -> dict:
    """CLIP 美学评分：与"好照片"描述的语义相似度"""
    import torch
    start = time.time()
    _lazy_load_clip()
    m = _clip_pipeline

    image = Image.open(image_path).convert('RGB')
    inputs = m['processor'](images=image, return_tensors='pt').to(m['device'])

    with torch.no_grad():
        img_feat = m['model'].get_image_features(**inputs)
        img_feat = img_feat / img_feat.norm(dim=-1, keepdim=True)

        text = m['processor'](
            text=["一张构图精美、曝光准确、色彩协调的优秀摄影作品",
                  "一张普通平淡、缺乏亮点的照片"],
            return_tensors='pt', padding=True
        ).to(m['device'])
        txt_feat = m['model'].get_text_features(**text)
        txt_feat = txt_feat / txt_feat.norm(dim=-1, keepdim=True)

        sim = (img_feat @ txt_feat.T).squeeze().cpu().numpy()
        # 映射到 1-10 分
        score = 5.0 + (float(sim[0]) - float(sim[1])) * 8.0
        score = max(1.0, min(10.0, score))

    return {
        'score': round(score, 2),
        'time': round(time.time() - start, 3),
        'details': {'评分范围': '1-10, 越高越好', '算法': 'CLIP-ViT-L/14 + 语义对比'},
    }


# ============================================================
# MUSIQ — Google Transformer 模型
# ============================================================

_musiq_pipeline = None

def _lazy_load_musiq():
    global _musiq_pipeline
    if _musiq_pipeline is not None:
        return
    import torch
    from transformers import AutoImageProcessor, AutoModelForImageQualityAssessment
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    try:
        processor = AutoImageProcessor.from_pretrained('google/musiq')
        model = AutoModelForImageQualityAssessment.from_pretrained('google/musiq')
        model.to(device).eval()
        _musiq_pipeline = {'model': model, 'processor': processor, 'device': device}
    except Exception as e:
        _musiq_pipeline = {'error': str(e)}


def musiq_score(image_path: str) -> dict:
    """MUSIQ 图像质量评分"""
    import torch
    start = time.time()
    _lazy_load_musiq()

    if 'error' in _musiq_pipeline:
        return {'score': 0, 'time': 0, 'error': 'MUSIQ 模型加载失败: ' + _musiq_pipeline['error']}

    try:
        image = Image.open(image_path).convert('RGB')
        inputs = _musiq_pipeline['processor'](images=image, return_tensors='pt').to(_musiq_pipeline['device'])

        with torch.no_grad():
            outputs = _musiq_pipeline['model'](**inputs)
            score = outputs.logits.mean().item()
            score = max(0, min(100, score))
    except Exception as e:
        return {'score': 0, 'time': round(time.time() - start, 3), 'error': str(e)}

    return {
        'score': round(score, 1),
        'time': round(time.time() - start, 3),
        'details': {'评分范围': '0-100', '算法': 'MUSIQ Transformer'},
    }


# ============================================================
# 大模型评分 — 复用现有 API 逻辑
# ============================================================

def llm_score(image_path: str) -> dict:
    """通过现有评分系统评分（异步，需查询结果）"""
    import requests
    start = time.time()

    try:
        # 创建评分任务
        with open(image_path, 'rb') as f:
            files = {'file': f}
            resp = requests.post(
                'http://localhost:8000/api/images/score',
                files=files, timeout=120
            )
            data = resp.json()
            tasks = data.get('tasks', [])
            if not tasks:
                return {'score': 0, 'time': round(time.time() - start, 3), 'error': '评分任务创建失败'}

            # 等待并查询结果（最多等 60 秒）
            import time as ttime
            image_id = tasks[0].get('image_id')
            for _ in range(30):
                ttime.sleep(2)
                res = requests.get(
                    f'http://localhost:8000/api/images/score/results/{image_id}',
                    timeout=10
                )
                if res.status_code == 200:
                    result = res.json()
                    total_score = result.get('total_score', 0)
                    elapsed = time.time() - start
                    return {
                        'score': round(float(total_score), 1) if total_score else 0,
                        'time': round(elapsed, 3),
                        'details': {'评分范围': '0-100', '算法': '大模型 API'},
                    }

            return {'score': 0, 'time': round(time.time() - start, 3), 'error': '评分超时'}

    except Exception as e:
        return {'score': 0, 'time': round(time.time() - start, 3), 'error': str(e)}


# ============================================================
# 统一调度入口
# ============================================================

SCHEMES = {
    'opencv':    {'name': 'OpenCV 技术检测',    'fn': opencv_technical},
    'clip':      {'name': 'CLIP+MLP 美学评分',   'fn': clip_aesthetic},
    'musiq':     {'name': 'MUSIQ 质量评分',      'fn': musiq_score},
    'llm':       {'name': '大模型评分',          'fn': llm_score},
}


def run_benchmark(image_path: str, selected_schemes: list[str]) -> dict:
    """运行选中的评分方案"""
    results = {}
    for key in selected_schemes:
        if key not in SCHEMES:
            results[key] = {'score': 0, 'time': 0, 'error': f'未知方案: {key}'}
            continue
        try:
            result = SCHEMES[key]['fn'](image_path)
            result['label'] = SCHEMES[key]['name']
            results[key] = result
        except Exception as e:
            results[key] = {'score': 0, 'time': 0, 'error': str(e), 'label': SCHEMES[key]['name']}
    return results
