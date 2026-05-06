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
    # 使用 PIL 读取（支持中文路径），再转 OpenCV 格式
    try:
        pil_img = Image.open(image_path).convert('RGB')
        img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
    except Exception:
        return {'score': 0, 'time': round(time.time() - start, 3), 'details': '无法读取图片'}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 清晰度: Laplacian 方差（校准自你照片实测: 模糊~50, 锐利~900）
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    sharpness = min(100, max(0, laplacian_var / 9))

    # 曝光: 直方图暗部/亮部占比
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
    total = np.sum(hist) + 1e-6
    dark_ratio = np.sum(hist[:30]) / total
    bright_ratio = np.sum(hist[225:]) / total
    exposure = 100 - min(100, (dark_ratio + bright_ratio) * 100)

    # 对比度: 灰度标准差（校准自实测: 平淡~45, 丰富~75）
    contrast = min(100, max(0, gray.std()))

    # 综合分 (加权)
    score = sharpness * 0.4 + exposure * 0.3 + contrast * 0.3

    return {
        'score': float(round(float(score), 2)),
        'time': round(time.time() - start, 3),
        'details': {
            '清晰度': float(round(float(sharpness), 2)),
            '曝光': float(round(float(exposure), 2)),
            '对比度': float(round(float(contrast), 2)),
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
    import os
    os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
    import torch
    import torch.nn as nn
    from transformers import CLIPProcessor, CLIPModel
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model = CLIPModel.from_pretrained('openai/clip-vit-large-patch14', local_files_only=True)
    processor = CLIPProcessor.from_pretrained('openai/clip-vit-large-patch14', local_files_only=True)
    model.to(device).eval()

    # LAION 美学预测器（线性层，768 → 1）
    aesthetic_path = Path(__file__).parent.parent / 'models' / 'aesthetic_linear.pth'
    aesthetic_model = None
    if aesthetic_path.exists():
        try:
            aesthetic_model = nn.Linear(768, 1)
            aesthetic_model.load_state_dict(torch.load(str(aesthetic_path), map_location='cpu'))
            aesthetic_model.to(device).eval()
        except Exception:
            aesthetic_model = None

    _clip_pipeline = {
        'model': model, 'processor': processor, 'device': device,
        'aesthetic': aesthetic_model,
    }


def clip_aesthetic(image_path: str) -> dict:
    """CLIP + LAION 美学评分（美学预测器优先，回退到语义对比）"""
    import torch
    start = time.time()
    _lazy_load_clip()
    m = _clip_pipeline

    image = Image.open(image_path).convert('RGB')
    inputs = m['processor'](images=image, return_tensors='pt').to(m['device'])

    with torch.no_grad():
        img_out = m['model'].get_image_features(**inputs)
        img_feat = img_out.pooler_output

        if m['aesthetic'] is not None:
            # LAION 美学预测器：需要先 L2 归一化再输入线性层
            normed = img_feat.float() / img_feat.float().norm(dim=-1, keepdim=True)
            raw = m['aesthetic'](normed).item()
            score = max(1.0, min(10.0, raw))
            algo = 'CLIP-ViT-L/14 + LAION 美学预测器'
        else:
            # 回退：语义对比
            img_feat = img_feat / img_feat.norm(dim=-1, keepdim=True)
            text = m['processor'](
                text=["an excellent photograph with beautiful composition, perfect exposure and harmonious colors",
                      "an ordinary, flat foto lacking any highlights"],
                return_tensors='pt', padding=True
            )
            text = {k: v.to(m['device']) for k, v in text.items()}
            txt_out = m['model'].get_text_features(**text)
            txt_feat = txt_out.pooler_output
            txt_feat = txt_feat / txt_feat.norm(dim=-1, keepdim=True)
            sim = (img_feat @ txt_feat.T).squeeze().cpu().numpy()
            score = 5.0 + (float(sim[0]) - float(sim[1])) * 8.0
            score = max(1.0, min(10.0, score))
            algo = 'CLIP-ViT-L/14 + 语义对比 (回退)'

    return {
        'score': round(score, 2),
        'time': round(time.time() - start, 3),
        'details': {'评分范围': '1-10, 越高越好', '算法': algo},
    }


# ============================================================
# MUSIQ — 基于 pyiqa 的 Transformer 质量评估
# ============================================================

_musiq = None

def _lazy_load_musiq():
    global _musiq
    if _musiq is not None:
        return
    import torch
    from pyiqa import create_metric
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    try:
        _musiq = create_metric('musiq', device=device)
    except Exception as e:
        _musiq = {'error': str(e)}


def musiq_score(image_path: str) -> dict:
    """MUSIQ 图像质量评分（通过 pyiqa，自动缩放避免 OOM）"""
    import torch
    start = time.time()
    _lazy_load_musiq()

    if isinstance(_musiq, dict) and 'error' in _musiq:
        return {'score': 0, 'time': 0, 'error': 'MUSIQ 加载失败: ' + _musiq['error']}

    try:
        image = Image.open(image_path).convert('RGB')
        # 缩放最长边到 2048px 避免大图 OOM（MUSIQ attention 复杂度与分辨率平方成正比）
        w, h = image.size
        if max(w, h) > 2048:
            ratio = 2048 / max(w, h)
            image = image.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

        torch.cuda.empty_cache()
        score = _musiq(image)
        score = max(0, min(100, score.item()))
    except torch.cuda.OutOfMemoryError:
        torch.cuda.empty_cache()
        return {'score': 0, 'time': round(time.time() - start, 3), 'error': '显存不足'}
    except Exception as e:
        return {'score': 0, 'time': round(time.time() - start, 3), 'error': str(e)}

    return {
        'score': round(score, 2),
        'time': round(time.time() - start, 3),
        'details': {'评分范围': '0-100', '算法': 'MUSIQ (pyiqa, 缩放至2048px)'},
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
                        'score': round(float(total_score), 2) if total_score else 0,
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


def _to_serializable(obj):
    """递归将 numpy 类型转为 Python 原生类型"""
    import numpy as np
    if isinstance(obj, (np.float32, np.float64)):
        return float(obj)
    if isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    if isinstance(obj, dict):
        return {k: _to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_to_serializable(v) for v in obj]
    return obj


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
    return _to_serializable(results)
