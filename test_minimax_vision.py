import requests
import base64
from PIL import Image
import io
import json

# 创建测试图片
img = Image.new('RGB', (100, 100), color='red')
buf = io.BytesIO()
img.save(buf, format='JPEG')
b64 = base64.b64encode(buf.getvalue()).decode()

API_KEY = "sk-cp-Lff7Uhdj1f1dr4Q7nshJ71S4p-taKTcDomWnQCmE8TYdHrcDPyqCr5h7KjnP1x1dIcGLYqa9fXq5soIyTFuVQYxgUuCMY_IkV-nvrND1suI2QtyITHJdpT8"

# 测试不同端点和格式
tests = [
    # Anthropic 格式
    ("Anthropic base64", "https://api.minimaxi.com/anthropic/v1/messages", {
        "model": "MiniMax-M2.7",
        "max_tokens": 100,
        "messages": [{
            "role": "user", 
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
                {"type": "text", "text": "描述"}
            ]
        }]
    }),
    # OpenAI 格式 (之前测试过的)
    ("OpenAI base64", "https://api.minimaxi.com/v1/chat/completions", {
        "model": "MiniMax-M2.7",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                {"type": "text", "text": "描述"}
            ]
        }],
        "max_tokens": 100
    }),
]

for name, url, payload in tests:
    print(f"\n=== {name} ===")
    print(f"URL: {url}")
    try:
        headers = {"Authorization": f"Bearer {API_KEY}"}
        if "anthropic" in url:
            headers["anthropic-version"] = "2023-06-01"
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        result = r.json()
        if "choices" in result:
            content = result["choices"][0]["message"].get("content", "")
            print(f"Success: {content[:100]}")
        elif "content" in result:
            print(f"Success: {result['content'][:100] if isinstance(result['content'], str) else str(result['content'][:2])}")
        else:
            print(f"Error/Other: {str(result)[:200]}")
    except Exception as e:
        print(f"Failed: {e}")
