"""
LUT 生成器 — 从原图+风格图提取 .cube LUT 文件

算法：采样原图和风格图的颜色对应关系，构建 33x33x33 3D LUT
"""
import numpy as np
from PIL import Image
from pathlib import Path
from collections import defaultdict


def rgb_to_index(r, g, b, lut_size=33):
    """RGB [0,255] → LUT 网格索引 [0, lut_size-1]"""
    return (
        min(int(r * (lut_size - 1) / 255.0 + 0.5), lut_size - 1),
        min(int(g * (lut_size - 1) / 255.0 + 0.5), lut_size - 1),
        min(int(b * (lut_size - 1) / 255.0 + 0.5), lut_size - 1),
    )


def index_to_rgb(ri, gi, bi, lut_size=33):
    """LUT 索引 → RGB 网格坐标 [0,1]"""
    return (ri / (lut_size - 1), gi / (lut_size - 1), bi / (lut_size - 1))


def generate_lut(source_path, styled_path, output_path, lut_size=33):
    """
    从原图 + 风格图提取 LUT

    Args:
        source_path: 原图路径
        styled_path: AI 生成的风格图路径  
        output_path: 输出 .cube 文件路径
        lut_size: LUT 精度，默认 33
    """
    # 加载图片并转为相同尺寸的 RGB numpy 数组
    src = Image.open(source_path).convert('RGB')
    styled = Image.open(styled_path).convert('RGB')

    # 对齐尺寸（取较小的）
    w = min(src.width, styled.width)
    h = min(src.height, styled.height)
    src = src.resize((w, h), Image.LANCZOS)
    styled = styled.resize((w, h), Image.LANCZOS)

    src_arr = np.array(src, dtype=np.float32)
    styled_arr = np.array(styled, dtype=np.float32)

    # 采样：每个 LUT 网格点对应的输出颜色
    lut_data = defaultdict(list)

    for y in range(h):
        for x in range(w):
            ri, gi, bi = rgb_to_index(
                src_arr[y, x, 0], src_arr[y, x, 1], src_arr[y, x, 2], lut_size
            )
            out_r, out_g, out_b = styled_arr[y, x, :]
            lut_data[(ri, gi, bi)].append((out_r, out_g, out_b))

    # 构建 LUT 网格：每个点用均值填充，无数据点用邻域插值
    lut = np.zeros((lut_size, lut_size, lut_size, 3), dtype=np.float32)

    for ri in range(lut_size):
        for gi in range(lut_size):
            for bi in range(lut_size):
                key = (ri, gi, bi)
                if key in lut_data:
                    samples = np.array(lut_data[key])
                    lut[ri, gi, bi] = samples.mean(axis=0) / 255.0
                else:
                    # 填充：找到最近的有数据点
                    closest = _find_closest(key, lut_data, search_radius=3)
                    if closest is not None:
                        samples = np.array(lut_data[closest])
                        lut[ri, gi, bi] = samples.mean(axis=0) / 255.0
                    else:
                        # 兜底：用线性插值
                        r_frac, g_frac, b_frac = index_to_rgb(ri, gi, bi, lut_size)
                        lut[ri, gi, bi] = (r_frac, g_frac, b_frac)

    # 保存 .cube 文件
    _write_cube(output_path, lut, lut_size)

    return output_path


def _find_closest(key, lut_data, search_radius=3):
    """在邻域内找最近的有数据网格点"""
    ri, gi, bi = key
    best_dist = float('inf')
    best_key = None

    for dr in range(-search_radius, search_radius + 1):
        for dg in range(-search_radius, search_radius + 1):
            for db in range(-search_radius, search_radius + 1):
                nk = (ri + dr, gi + dg, bi + db)
                if nk in lut_data:
                    dist = dr * dr + dg * dg + db * db
                    if dist < best_dist:
                        best_dist = dist
                        best_key = nk
    return best_key


def _write_cube(path, lut, lut_size):
    """写入 .cube LUT 文件"""
    with open(path, 'w') as f:
        f.write(f'TITLE "Generated LUT"\n')
        f.write(f'LUT_3D_SIZE {lut_size}\n')
        f.write(f'DOMAIN_MIN 0.0 0.0 0.0\n')
        f.write(f'DOMAIN_MAX 1.0 1.0 1.0\n')

        for bi in range(lut_size):
            for gi in range(lut_size):
                for ri in range(lut_size):
                    r, g, b = lut[ri, gi, bi]
                    f.write(f'{r:.6f} {g:.6f} {b:.6f}\n')

    print(f"LUT saved: {path} ({lut_size}x{lut_size}x{lut_size})")


def apply_lut(image_path, lut_path, output_path):
    """
    把 .cube LUT 应用到图片
    
    Args:
        image_path: 输入图片
        lut_path: .cube 文件路径
        output_path: 输出图片
    """
    # 读取 LUT
    with open(lut_path) as f:
        lines = [l.strip() for l in f if l.strip() and not l.startswith('#')]

    lut_size = None
    data_start = 0
    for i, line in enumerate(lines):
        if line.startswith('LUT_3D_SIZE'):
            lut_size = int(line.split()[-1])
        if not line.startswith(('TITLE', 'LUT_3D_SIZE', 'DOMAIN_MIN', 'DOMAIN_MAX')):
            if lut_size is not None:
                data_start = i
                break

    if lut_size is None:
        raise ValueError("Invalid .cube file: no LUT_3D_SIZE")

    # 解析 LUT 数据
    data_lines = lines[data_start:]
    lut = np.zeros((lut_size, lut_size, lut_size, 3), dtype=np.float32)

    idx = 0
    for bi in range(lut_size):
        for gi in range(lut_size):
            for ri in range(lut_size):
                if idx < len(data_lines):
                    parts = data_lines[idx].split()
                    lut[ri, gi, bi] = [float(parts[0]), float(parts[1]), float(parts[2])]
                    idx += 1

    # 应用 LUT 到图片
    img = Image.open(image_path).convert('RGB')
    arr = np.array(img, dtype=np.float32) / 255.0

    # 三线性插值查找
    scale = (lut_size - 1)
    ri = arr[:, :, 0] * scale
    gi = arr[:, :, 1] * scale
    bi = arr[:, :, 2] * scale

    r0 = np.clip(np.floor(ri).astype(int), 0, lut_size - 2)
    g0 = np.clip(np.floor(gi).astype(int), 0, lut_size - 2)
    b0 = np.clip(np.floor(bi).astype(int), 0, lut_size - 2)
    r1 = np.clip(r0 + 1, 0, lut_size - 1)
    g1 = np.clip(g0 + 1, 0, lut_size - 1)
    b1 = np.clip(b0 + 1, 0, lut_size - 1)

    rd = ri - r0
    gd = gi - g0
    bd = bi - b0

    c000 = lut[r0, g0, b0]
    c001 = lut[r0, g0, b1]
    c010 = lut[r0, g1, b0]
    c011 = lut[r0, g1, b1]
    c100 = lut[r1, g0, b0]
    c101 = lut[r1, g0, b1]
    c110 = lut[r1, g1, b0]
    c111 = lut[r1, g1, b1]

    bd3 = bd[:, :, np.newaxis]
    gd3 = gd[:, :, np.newaxis]
    rd3 = rd[:, :, np.newaxis]

    c00 = c000 * (1 - rd3) + c100 * rd3
    c01 = c001 * (1 - rd3) + c101 * rd3
    c10 = c010 * (1 - rd3) + c110 * rd3
    c11 = c011 * (1 - rd3) + c111 * rd3

    c0 = c00 * (1 - gd3) + c10 * gd3
    c1 = c01 * (1 - gd3) + c11 * gd3

    result = c0 * (1 - bd3) + c1 * bd3
    result = np.clip(result * 255, 0, 255).astype(np.uint8)

    Image.fromarray(result).save(output_path)
    print(f"LUT applied: {output_path}")


# ============ CLI ============
if __name__ == '__main__':
    import sys

    if len(sys.argv) < 4:
        print("Usage:")
        print("  Generate LUT: python lut_gen.py gen <source.jpg> <styled.jpg> <output.cube>")
        print("  Apply LUT:    python lut_gen.py apply <input.jpg> <lut.cube> <output.jpg>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'gen':
        source, styled, output = sys.argv[2], sys.argv[3], sys.argv[4]
        generate_lut(source, styled, output)

    elif cmd == 'apply':
        img, lut_file, output = sys.argv[2], sys.argv[3], sys.argv[4]
        apply_lut(img, lut_file, output)

    else:
        print(f"Unknown command: {cmd}")
