"""
LUT 克隆 API — 色彩迁移 + LUT 提取 + 下载
"""
import os
import uuid
import tempfile
import numpy as np
from PIL import Image
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import FileResponse
from config import PHOTO_ROOT

router = APIRouter(prefix="/api/lut", tags=["lut"])

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "lut_outputs")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def _lab_transfer(source_img: Image.Image, ref_img: Image.Image) -> Image.Image:
    """
    基于 Lab 色彩空间的颜色迁移。
    参考: Reinhard et al. "Color Transfer between Images"
    """
    import numpy as np

    src = np.array(source_img.convert('RGB'), dtype=np.float32)
    ref = np.array(ref_img.convert('RGB'), dtype=np.float32)

    # 限制最大尺寸避免内存溢出
    MAX_DIM = 2048
    h, w = src.shape[:2]
    if max(h, w) > MAX_DIM:
        scale = MAX_DIM / max(h, w)
        src = np.array(Image.fromarray(src.astype(np.uint8)).resize((int(w*scale), int(h*scale)), Image.LANCZOS), dtype=np.float32)

    # 对齐尺寸到较小者以便匹配
    tw = min(src.shape[1], ref.shape[1])
    th = min(src.shape[0], ref.shape[0])
    src_resized = np.array(Image.fromarray(src.astype(np.uint8)).resize((tw, th), Image.LANCZOS), dtype=np.float32)
    ref_resized = np.array(Image.fromarray(ref.astype(np.uint8)).resize((tw, th), Image.LANCZOS), dtype=np.float32)

    # RGB → LMS → Lab (简化)
    src_lab = _rgb_to_lab(src_resized)
    ref_lab = _rgb_to_lab(ref_resized)

    # 匹配均值和标准差
    mean_src = src_lab.mean(axis=(0, 1))
    std_src = src_lab.std(axis=(0, 1))
    mean_ref = ref_lab.mean(axis=(0, 1))
    std_ref = ref_lab.std(axis=(0, 1))

    src_lab_transferred = (src_lab - mean_src) * (std_ref / (std_src + 1e-8)) + mean_ref
    rgb = _lab_to_rgb(src_lab_transferred)

    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))


def _rgb_to_lab(rgb):
    """RGB [0,255] → Lab"""
    rgb = rgb / 255.0
    # sRGB → XYZ
    mask = rgb > 0.04045
    rgb[mask] = ((rgb[mask] + 0.055) / 1.055) ** 2.4
    rgb[~mask] /= 12.92

    rgb = rgb.reshape(-1, 3)
    xyz = np.dot(rgb, np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041]
    ]).T)

    # XYZ → Lab
    xyz /= np.array([0.95047, 1.0, 1.08883])
    mask = xyz > 0.008856
    xyz[mask] = np.cbrt(xyz[mask])
    xyz[~mask] = 7.787 * xyz[~mask] + 16.0 / 116.0

    lab = np.zeros_like(xyz)
    lab[:, 0] = 116.0 * xyz[:, 1] - 16.0
    lab[:, 1] = 500.0 * (xyz[:, 0] - xyz[:, 1])
    lab[:, 2] = 200.0 * (xyz[:, 1] - xyz[:, 2])

    return lab.reshape(rgb.shape[0] // 3, -1, 3)


def _lab_to_rgb(lab):
    """Lab → RGB [0,255]"""
    h, w = lab.shape[0], lab.shape[1]
    lab = lab.reshape(-1, 3)

    # Lab → XYZ
    y = (lab[:, 0] + 16.0) / 116.0
    x = lab[:, 1] / 500.0 + y
    z = y - lab[:, 2] / 200.0

    xyz = np.stack([x, y, z], axis=1)
    mask = xyz > 0.2068966
    xyz[mask] = xyz[mask] ** 3
    xyz[~mask] = (xyz[~mask] - 16.0 / 116.0) / 7.787

    xyz *= np.array([0.95047, 1.0, 1.08883])

    # XYZ → sRGB
    rgb = np.dot(xyz, np.array([
        [3.2404542, -1.5371385, -0.4985314],
        [-0.9692660, 1.8760108, 0.0415560],
        [0.0556434, -0.2040259, 1.0572252]
    ]).T)

    mask = rgb > 0.0031308
    rgb[mask] = 1.055 * (rgb[mask] ** (1.0 / 2.4)) - 0.055
    rgb[~mask] *= 12.92

    return (np.clip(rgb, 0, 1) * 255).reshape(h, w, 3)



@router.post("/transfer")
async def transfer_colors(source: UploadFile = File(...), reference: UploadFile = File(...)):
    """上传原图+参考图，返回色彩迁移结果"""
    task_id = uuid.uuid4().hex[:8]

    src_bytes = await source.read()
    ref_bytes = await reference.read()

    src_img = Image.open(__import__('io').BytesIO(src_bytes))
    ref_img = Image.open(__import__('io').BytesIO(ref_bytes))

    result = _lab_transfer(src_img, ref_img)

    out_path = os.path.join(OUTPUT_DIR, f"transfer_{task_id}.jpg")
    result.save(out_path, 'JPEG', quality=95)

    return {"task_id": task_id, "url": f"/api/lut/output/transfer_{task_id}.jpg"}


@router.get("/output/{filename}")
async def get_output(filename: str):
    """获取生成的图片"""
    path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(path):
        return {"error": "File not found"}
    return FileResponse(path)


@router.post("/extract")
async def extract_lut(source: UploadFile = File(...), styled: UploadFile = File(...)):
    """上传原图+风格图，提取 .cube LUT 文件"""
    task_id = uuid.uuid4().hex[:8]

    src_bytes = await source.read()
    styled_bytes = await styled.read()

    src_path = os.path.join(tempfile.gettempdir(), f"lut_src_{task_id}.jpg")
    styled_path = os.path.join(tempfile.gettempdir(), f"lut_styled_{task_id}.jpg")

    with open(src_path, 'wb') as f:
        f.write(src_bytes)
    with open(styled_path, 'wb') as f:
        f.write(styled_bytes)

    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from lut_gen import generate_lut, generate_hald
    out_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}.cube")
    generate_lut(src_path, styled_path, out_path, lut_size=33)
    hald_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}.png")
    generate_hald(out_path, hald_path, hald_size=64)

    return {
        "task_id": task_id,
        "cube": f"/api/lut/download/lut_{task_id}.cube",
        "hald": f"/api/lut/download/lut_{task_id}.png"
    }


@router.get("/download/{filename}")
async def download_lut(filename: str):
    """下载 .cube LUT 文件"""
    path = os.path.join(OUTPUT_DIR, filename)
    if not os.path.exists(path):
        return {"error": "File not found"}
    return FileResponse(path, filename=filename, media_type='application/octet-stream')


@router.post("/preview")
async def preview_lut(lut: UploadFile = File(...), test_image: UploadFile = File(...)):
    """上传 LUT 文件 + 测试图 → 返回套用 LUT 后的预览图"""
    import tempfile
    task_id = uuid.uuid4().hex[:8]

    lut_bytes = await lut.read()
    img_bytes = await test_image.read()

    lut_path = os.path.join(tempfile.gettempdir(), f"preview_lut_{task_id}.cube")
    img_path = os.path.join(tempfile.gettempdir(), f"preview_img_{task_id}.jpg")

    with open(lut_path, 'wb') as f:
        f.write(lut_bytes)
    with open(img_path, 'wb') as f:
        f.write(img_bytes)

    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from lut_gen import apply_lut

    out_path = os.path.join(OUTPUT_DIR, f"preview_{task_id}.jpg")
    apply_lut(img_path, lut_path, out_path)

    return {"task_id": task_id, "url": f"/api/lut/output/preview_{task_id}.jpg"}
