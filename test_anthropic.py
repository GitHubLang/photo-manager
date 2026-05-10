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
API_URL = "https://api.minimaxi.com/anthropic/v1/messages"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
}

payload = {
    "model": "MiniMax-M2.7",
    "max_tokens": 100,
    "messages": [{
        "role": "user",
        "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
            {"type": "text", "text": "简单描述这张图片"}
        ]
    }]
}

print("Testing Anthropic endpoint...")
try:
    r = requests.post(API_URL, json=payload, headers=headers, timeout=30)
    print(f"Status: {r.status_code}")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
