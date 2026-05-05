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


def _generate_xmp(src_path, styled_path, output_path):
    """从原图+风格图推导 Lightroom .xmp 预设（含色调曲线+HSL）"""
    import numpy as np
    src = np.array(Image.open(src_path).resize((512, 512), Image.LANCZOS).convert('RGB'), dtype=np.float32) / 255.0
    styled = np.array(Image.open(styled_path).resize((512, 512), Image.LANCZOS).convert('RGB'), dtype=np.float32) / 255.0

    # --- 基础调整 ---
    src_mean = src.mean(axis=(0,1))
    styled_mean = styled.mean(axis=(0,1))
    diff = (styled_mean - src_mean) * 100
    exp_adj = round(np.log2(max(styled_mean.mean(), 0.001) / max(src_mean.mean(), 0.001)), 2)
    contrast_adj = int((styled.std() / max(src.std(), 0.001) - 1) * 35)
    temp_adj = int(diff[0] * 15 - diff[2] * 15)
    tint_adj = int(diff[1] * 25)
    sat_adj = int((diff[0] + diff[1] + diff[2]) / 3 * 25)
    vib_adj = int(diff[1] * 15)

    # 高光/阴影
    h_src = np.percentile(src, 95)
    h_styled = np.percentile(styled, 95)
    s_src = np.percentile(src, 5)
    s_styled = np.percentile(styled, 5)
    highlights_adj = int((h_styled / max(h_src, 0.01) - 1) * 50)
    shadows_adj = int((s_styled / max(s_src, 0.01) - 1) * 50)

    # --- HSL 分析：8个色相段的偏移 ---
    def rgb_to_hsl(rgb):
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        mx = np.maximum(np.maximum(r, g), b)
        mn = np.minimum(np.minimum(r, g), b)
        d = mx - mn
        l = (mx + mn) / 2
        s = np.where(d == 0, 0, np.where(l > 0.5, d / (2 - mx - mn), d / (mx + mn)))
        h = np.where(d == 0, 0,
            np.where(mx == r, ((g - b) / d) % 6,
            np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4))) / 6
        return np.stack([h, s, l], axis=-1)

    src_hsl = rgb_to_hsl(src)
    styled_hsl = rgb_to_hsl(styled)
    hue_bins = [0, 0.042, 0.083, 0.167, 0.25, 0.33, 0.5, 0.67, 1.0]  # red/orange/yellow/green/aqua/blue/purple/magenta
    hsl_names = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta']
    hsl_shifts = []
    for i in range(8):
        mask = (src_hsl[..., 0] >= hue_bins[i]) & (src_hsl[..., 0] < hue_bins[i+1]) & (src_hsl[..., 1] > 0.05)
        if mask.sum() > 100:
            hue_shift = int((styled_hsl[mask][:, 0].mean() - src_hsl[mask][:, 0].mean()) * 100)
            sat_shift = int((styled_hsl[mask][:, 1].mean() - src_hsl[mask][:, 1].mean()) * 100 * 2)
            lum_shift = int((styled_hsl[mask][:, 2].mean() - src_hsl[mask][:, 2].mean()) * 100)
        else:
            hue_shift = sat_shift = lum_shift = 0
        hsl_shifts.append((hsl_names[i], hue_shift, sat_shift, lum_shift))

    # --- 色调曲线 ---
    # 分析暗部/中间调/亮部的RGB偏移
    def curve_points(arr_src, arr_styled, percentiles=[10, 30, 50, 70, 90]):
        pts = []
        for p in percentiles:
            v_src = np.percentile(arr_src, p)
            v_styled = np.percentile(arr_styled, p)
            shift = int((v_styled / max(v_src, 0.01) - 1) * 100)
            pts.append(shift)
        return pts

    r_curve = curve_points(src[..., 0].flatten(), styled[..., 0].flatten())
    g_curve = curve_points(src[..., 1].flatten(), styled[..., 1].flatten())
    b_curve = curve_points(src[..., 2].flatten(), styled[..., 2].flatten())

    # --- 色彩分级 ---
    s_lo = np.percentile(src, [5], axis=(0,1))
    s_hi = np.percentile(src, [95], axis=(0,1))
    t_lo = np.percentile(styled, [5], axis=(0,1))
    t_hi = np.percentile(styled, [95], axis=(0,1))
    shadow_hue_shift = int((t_lo[0,0] - s_lo[0,0]) * 50)
    shadow_sat_shift = int((t_lo[0][:, None].std() - s_lo[0][:, None].std()) * 100)
    highlight_hue_shift = int((t_hi[0,0] - s_hi[0,0]) * 50)
    highlight_sat_shift = int((t_hi[0][:, None].std() - s_hi[0][:, None].std()) * 100)

    # --- 生成 XMP ---
    xmp = '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
    xmp += '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n'
    xmp += ' <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
    xmp += '  <rdf:Description rdf:about=""\n'
    xmp += '   xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/">\n'
    xmp += f'   <crs:Version>15.0</crs:Version>\n'
    xmp += f'   <crs:ProcessVersion>15.4</crs:ProcessVersion>\n'
    # 基础
    xmp += f'   <crs:Exposure2012>{exp_adj:+.4f}</crs:Exposure2012>\n'
    xmp += f'   <crs:Contrast2012>{contrast_adj}</crs:Contrast2012>\n'
    xmp += f'   <crs:Highlights2012>{highlights_adj}</crs:Highlights2012>\n'
    xmp += f'   <crs:Shadows2012>{shadows_adj}</crs:Shadows2012>\n'
    xmp += f'   <crs:Temperature>{5000 + temp_adj}</crs:Temperature>\n'
    xmp += f'   <crs:Tint>{tint_adj}</crs:Tint>\n'
    xmp += f'   <crs:Saturation>{sat_adj}</crs:Saturation>\n'
    xmp += f'   <crs:Vibrance>{vib_adj}</crs:Vibrance>\n'
    # HSL
    for name, hue, sat, lum in hsl_shifts:
        xmp += f'   <crs:HueAdjustment{name}>{hue}</crs:HueAdjustment{name}>\n'
        xmp += f'   <crs:SaturationAdjustment{name}>{sat}</crs:SaturationAdjustment{name}>\n'
        xmp += f'   <crs:LuminanceAdjustment{name}>{lum}</crs:LuminanceAdjustment{name}>\n'
    # 曲线
    for ch, vals in [('Red', r_curve), ('Green', g_curve), ('Blue', b_curve)]:
        pts = ' '.join(f'{s}' for s in vals)
        pts += ' 0 0 0 0 0 0 0 0 0 0'  # pad to 14 params
        xmp += f'   <crs:Parametric{ch}Split>{pts}</crs:Parametric{ch}Split>\n'
    # 色彩分级
    xmp += f'   <crs:ShadowTint>{shadow_hue_shift}</crs:ShadowTint>\n'
    xmp += f'   <crs:ShadowTintSaturation>{shadow_sat_shift}</crs:ShadowTintSaturation>\n'
    xmp += f'   <crs:HighlightTint>{highlight_hue_shift}</crs:HighlightTint>\n'
    xmp += f'   <crs:HighlightTintSaturation>{highlight_sat_shift}</crs:HighlightTintSaturation>\n'
    xmp += '  </rdf:Description>\n'
    xmp += ' </rdf:RDF>\n'
    xmp += '</x:xmpmeta>\n'
    xmp += '<?xpacket end="r"?>\n'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xmp)


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
    xmp_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}.xmp")
    _generate_xmp(src_path, styled_path, xmp_path)

    return {
        "task_id": task_id,
        "cube": f"/api/lut/download/lut_{task_id}.cube",
        "hald": f"/api/lut/download/lut_{task_id}.png",
        "xmp": f"/api/lut/download/lut_{task_id}.xmp"
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
