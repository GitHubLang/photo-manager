import requests
import base64
from PIL import Image
import io

# 创建测试图片
img = Image.new('RGB', (100, 100), color='red')
buf = io.BytesIO()
img.save(buf, format='JPEG')
b64 = base64.b64encode(buf.getvalue()).decode()

API_KEY = "sk-cp-Lff7Uhdj1f1dr4Q7nshJ71S4p-taKTcDomWnQCmE8TYdHrcDPyqCr5h7KjnP1x1dIcGLYqa9fXq5soIyTFuVQYxgUuCMY_IkV-nvrND1suI2QtyITHJdpT8"

url = "https://api.minimaxi.com/v1/coding_plan/vlm"
payload = {
    "prompt": "简单描述这张图片，用中文回答",
    "image_url": f"data:image/jpeg;base64,{b64}"
}
headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "MM-API-Source": "OpenClaw"
}

print("Testing MiniMax-VL-01 model...")
try:
    r = requests.post(url, json=payload, headers=headers, timeout=30)
    print(f"Status: {r.status_code}")
    result = r.json()
    print(f"Response: {result}")
except Exception as e:
    print(f"Error: {e}")
