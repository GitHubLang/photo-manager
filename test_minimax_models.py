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
API_URL = "https://api.minimaxi.com/v1/chat/completions"

# 测试不同的模型
models_to_test = [
    "MiniMax-VL01",
    "miniMax-vl-01", 
    "MiniMax-VL",
    "minimax-vl",
    "MiniMax-M2.7",
]

for model in models_to_test:
    print(f"\n=== Testing {model} ===")
    try:
        payload = {
            "model": model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    {"type": "text", "text": "简单描述这张图片"}
                ]
            }],
            "max_tokens": 100
        }
        r = requests.post(API_URL, json=payload, headers={"Authorization": f"Bearer {API_KEY}"}, timeout=30)
        result = r.json()
        if "choices" in result:
            content = result["choices"][0]["message"]["content"]
            print(f"Success! Response: {content[:100]}")
        else:
            print(f"Error: {result.get('error', {}).get('message', result)}")
    except Exception as e:
        print(f"Failed: {e}")
