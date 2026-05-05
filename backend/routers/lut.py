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
    """从原图+风格图推导 Lightroom .xmp 预设（参考 lightroom-preset-maker 算法）"""
    import cv2
    import numpy as np

    def load_bgr(p):
        return cv2.imdecode(np.fromfile(p, dtype=np.uint8), cv2.IMREAD_COLOR)

    ref = load_bgr(styled_path)
    src = load_bgr(src_path)
    if ref is None or src is None:
        print(f"Cannot load images: {src_path}, {styled_path}")
        return False

    h = min(src.shape[0], ref.shape[0])
    w = min(src.shape[1], ref.shape[1])
    src = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA)
    ref = cv2.resize(ref, (w, h), interpolation=cv2.INTER_AREA)

    src_lab = cv2.cvtColor(src, cv2.COLOR_BGR2LAB).astype(np.float32)
    ref_lab = cv2.cvtColor(ref, cv2.COLOR_BGR2LAB).astype(np.float32)
    src_hsv = cv2.cvtColor(src, cv2.COLOR_BGR2HSV).astype(np.float32)
    ref_hsv = cv2.cvtColor(ref, cv2.COLOR_BGR2HSV).astype(np.float32)

    # --- 曝光 (使用中间调区域加权) ---
    r_mean_lum = np.mean(ref_lab[:,:,0])
    s_mean_lum = np.mean(src_lab[:,:,0])
    r_mid = np.mean(ref_lab[(ref_lab[:,:,0] > 85) & (ref_lab[:,:,0] < 170)])
    s_mid = np.mean(src_lab[(src_lab[:,:,0] > 85) & (src_lab[:,:,0] < 170)])
    r_mid = r_mid if not np.isnan(r_mid) else r_mean_lum
    s_mid = s_mid if not np.isnan(s_mid) else s_mean_lum
    exp = round((0.6 * (r_mid - s_mid) + 0.4 * (r_mean_lum - s_mean_lum)) / 50.0, 2)

    # --- 对比度 (标准差+动态范围混合) ---
    r_std = np.std(ref_lab[:,:,0])
    s_std = np.std(src_lab[:,:,0])
    r_range = np.percentile(ref_lab[:,:,0], 95) - np.percentile(ref_lab[:,:,0], 5)
    s_range = np.percentile(src_lab[:,:,0], 95) - np.percentile(src_lab[:,:,0], 5)
    contrast_ratio = 0.7 * (r_std / max(s_std, 1e-6)) + 0.3 * (r_range / max(s_range, 1e-6))
    contrast = max(-100, min(100, int((contrast_ratio - 1.0) * 100)))

    # --- 色温/色调 (Lightroom用Kelvin, 加5500基准) ---
    temp = max(2000, min(50000, 5500 + int((np.mean(ref_lab[:,:,2]) - np.mean(src_lab[:,:,2])) * 5)))
    tint = int((np.mean(ref_lab[:,:,1]) - np.mean(src_lab[:,:,1])) * 0.5)

    # --- 高光/阴影/白色/黑色 (百分位) ---
    tone_vals = {}
    for what in ['Highlights', 'Shadows', 'Whites', 'Blacks']:
        pct = {'Highlights': 90, 'Shadows': 10, 'Whites': 95, 'Blacks': 5}[what]
        rv = np.percentile(ref_lab[:,:,0], pct)
        sv = np.percentile(src_lab[:,:,0], pct)
        tone_vals[what] = max(-100, min(100, int((rv - sv) / 2.55)))
    highlights, shadows, whites, blacks = [tone_vals[w] for w in ['Highlights','Shadows','Whites','Blacks']]

    # --- 饱和度 ---
    r_sat = np.mean(ref_hsv[:,:,1])
    s_sat = np.mean(src_hsv[:,:,1])
    saturation = max(-100, min(100, int((r_sat - s_sat) / 2.55)))
    vibrance = int(saturation * 0.7)

    # --- 纹理/清晰度/去雾 ---
    texture = max(-100, min(100, int(contrast * 0.3)))
    clarity = max(-100, min(100, int(contrast * 0.5)))
    dehaze = 0

    # --- HSL (8色相段) ---
    color_ranges = [
        ('Red', 0, 22), ('Orange', 22, 45), ('Yellow', 45, 67),
        ('Green', 67, 135), ('Aqua', 135, 157),
        ('Blue', 157, 247), ('Purple', 247, 280), ('Magenta', 280, 360)
    ]
    hsl_data = {}
    for name, hmin, hmax in color_ranges:
        mr = ((ref_hsv[:,:,0] >= hmin) & (ref_hsv[:,:,0] < hmax)).astype(float)
        ms = ((src_hsv[:,:,0] >= hmin) & (src_hsv[:,:,0] < hmax)).astype(float)
        if mr.sum() > 100 and ms.sum() > 100:
            h = max(-100, min(100, int((np.sum(ref_hsv[:,:,0]*mr)/mr.sum() - np.sum(src_hsv[:,:,0]*ms)/ms.sum()) / 1.8)))
            s = max(-100, min(100, int((np.sum(ref_hsv[:,:,1]*mr)/mr.sum() - np.sum(src_hsv[:,:,1]*ms)/ms.sum()) / 2.55)))
            l = max(-100, min(100, int((np.sum(ref_hsv[:,:,2]*mr)/mr.sum() - np.sum(src_hsv[:,:,2]*ms)/ms.sum()) / 2.55)))
        else:
            h = s = l = 0
        hsl_data[name] = (h, s, l)

    # --- 色调曲线 (PV2012) ---
    tc = []
    for pct in [0, 12.5, 25, 50, 75, 87.5, 100]:
        rv = np.percentile(ref_lab[:,:,0], pct)
        sv = np.percentile(src_lab[:,:,0], pct)
        tc.append(f"{sv / 255.0:.6f} {rv / 255.0:.6f}")

    # --- 色彩分级 ---
    cg = {}
    for name, lo, hi in [('Shadows', 0, 85), ('Midtones', 85, 170), ('Highlights', 170, 255)]:
        rm = (ref_lab[:,:,0] >= lo) & (ref_lab[:,:,0] < hi)
        sm = (src_lab[:,:,0] >= lo) & (src_lab[:,:,0] < hi)
        if rm.sum() > 100 and sm.sum() > 100:
            ra = ref_lab[rm][:, 1:].mean(axis=0)
            sa = src_lab[sm][:, 1:].mean(axis=0)
            cg[name] = (int((ra[0] - sa[0]) * 0.5), int((ra[1] - sa[1]) * 0.5))
        else:
            cg[name] = (0, 0)

    # --- XYZ 校准 ---
    cal = {}
    for ch in range(3):
        hv = max(-100, min(100, int((np.mean(ref_lab[..., ch]) - np.mean(src_lab[..., ch])) * 0.3)))
        sv = max(-100, min(100, int((np.mean(ref_hsv[..., 1]) - np.mean(src_hsv[..., 1])) * 0.3)))
        cal[ch] = (hv, sv)

    # --- 生成 XMP ---
    hsl_xml = ''
    for name, (h, s, l) in hsl_data.items():
        hsl_xml += f'    crs:HueAdjustment{name}="{h}"\n'
        hsl_xml += f'    crs:SaturationAdjustment{name}="{s}"\n'
        hsl_xml += f'    crs:LuminanceAdjustment{name}="{l}"\n'

    tc_xml = '    <crs:ToneCurvePV2012>\n     <rdf:Seq>\n'
    for pt in tc:
        tc_xml += f'      <rdf:li>{pt}</rdf:li>\n'
    tc_xml += '     </rdf:Seq>\n    </crs:ToneCurvePV2012>\n'

    xmp = f'''<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Photo Manager XMP Generator">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
   xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
   crs:Version="15.0"
   crs:ProcessVersion="15.4"
   crs:Temperature="{temp}"
   crs:Tint="{tint}"
   crs:Exposure2012="{round(exp, 2)}"
   crs:Contrast2012="{contrast}"
   crs:Highlights2012="{highlights}"
   crs:Shadows2012="{shadows}"
   crs:Whites2012="{whites}"
   crs:Blacks2012="{blacks}"
   crs:Texture="{texture}"
   crs:Clarity="{clarity}"
   crs:Dehaze="{dehaze}"
   crs:Vibrance="{vibrance}"
   crs:Saturation="{saturation}"
{hsl_xml}   crs:ColorGradeShadowsHue="{cg['Shadows'][0]}"
   crs:ColorGradeShadowsSat="{cg['Shadows'][1]}"
   crs:ColorGradeMidtonesHue="{cg['Midtones'][0]}"
   crs:ColorGradeMidtonesSat="{cg['Midtones'][1]}"
   crs:ColorGradeHighlightsHue="{cg['Highlights'][0]}"
   crs:ColorGradeHighlightsSat="{cg['Highlights'][1]}"
   crs:RedPrimaryHue="{cal[0][0]}"
   crs:RedPrimarySat="{cal[0][1]}"
   crs:GreenPrimaryHue="{cal[1][0]}"
   crs:GreenPrimarySat="{cal[1][1]}"
   crs:BluePrimaryHue="{cal[2][0]}"
   crs:BluePrimarySat="{cal[2][1]}">
{tc_xml}  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>'''

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(xmp)
    print(f"XMP saved: {output_path}")
    return True

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

    import sys, subprocess, shutil, tempfile as tf
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    out_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}.cube")

    # 使用 3dlut-creator (KNN+Gaussian) 生成高质量 .cube
    tmp_a = os.path.join(tf.gettempdir(), f"3dlut_a_{task_id}")
    tmp_b = os.path.join(tf.gettempdir(), f"3dlut_b_{task_id}")
    os.makedirs(tmp_a, exist_ok=True)
    os.makedirs(tmp_b, exist_ok=True)
    # 用相同文件名实现匹配
    pair_name = "input_pair.jpg"
    shutil.copy2(src_path, os.path.join(tmp_a, pair_name))
    shutil.copy2(styled_path, os.path.join(tmp_b, pair_name))

    _3d_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "3dlut-creator")
    tmp_out = os.path.join(tf.gettempdir(), f"3dlut_out_{task_id}")
    result = subprocess.run([
        sys.executable, os.path.join(_3d_dir, "main.py"),
        "--photoa", tmp_a,
        "--photob", tmp_b,
        "--output", tmp_out,
        "--size", "33",
        "--formats", "cube",
        "--title", f"LUT_{task_id}"
    ], capture_output=True, text=True, timeout=120, cwd=_3d_dir,
       env={**os.environ, "PYTHONIOENCODING": "utf-8"})

    generated = f"{tmp_out}.cube"
    if os.path.exists(generated):
        shutil.copy2(generated, out_path)
    else:
        # 回退到原来的算法
        from lut_gen import generate_lut
        generate_lut(src_path, styled_path, out_path, lut_size=33)

    # 清 temp
    for d in [tmp_a, tmp_b]: shutil.rmtree(d, ignore_errors=True)
    if os.path.exists(f"{tmp_out}.cube"): os.remove(f"{tmp_out}.cube")

    # HALD + XMP 仍用现有逻辑
    from lut_gen import generate_hald
    hald_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}.png")
    generate_hald(out_path, hald_path, hald_size=64)
    xmp_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}.xmp")
    _generate_xmp(src_path, styled_path, xmp_path)
    # 从 .cube 生成 Lightroom 配置 .xmp
    profile_path = os.path.join(OUTPUT_DIR, f"lut_{task_id}_lr.xmp")
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from cube_to_xmp import cube_to_lightroom_xmp
    cube_to_lightroom_xmp(out_path, profile_path, f"LUT_{task_id}")

    return {
        "task_id": task_id,
        "cube": f"/api/lut/download/lut_{task_id}.cube",
        "hald": f"/api/lut/download/lut_{task_id}.png",
        "xmp": f"/api/lut/download/lut_{task_id}.xmp",
        "profile": f"/api/lut/download/lut_{task_id}_lr.xmp"
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
