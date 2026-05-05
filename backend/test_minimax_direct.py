import requests
import json

api_key = "sk-cp-Lff7Uhdj1f1dr4Q7nshJ71S4p-taKTcDomWnQCmE8TYdHrcDPyqCr5h7KjnP1x1dIcGLYqa9fXq5soIyTFuVQYxgUuCMY_IkV-nvrND1suI2QtyITHJdpT8"
api_url = "https://api.minimax.chat/v1/chat/completions"

# Test with a prompt similar to what generate_caption sends
prompt = """你是小红书内容创作者。请根据以下照片内容，生成小红书文案。
照片描述：
- test.jpg: 无描述

请生成以下JSON格式（只返回JSON）：
{"title": "标题", "content": "正文", "hashtags": "#话题1 #话题2"}"""

payload = {
    "model": "MiniMax-M2.7",
    "messages": [{"role": "user", "content": prompt}],
    "max_tokens": 500,
    "temperature": 0.5
}

headers = {"Authorization": f"Bearer {api_key}"}
response = requests.post(api_url, headers=headers, json=payload, timeout=60)
print(f"Status: {response.status_code}")

# Print raw text length and first 300 chars
text = response.text
print(f"Raw text length: {len(text)}")
print(f"First 300 chars: {text[:300]}")

# Try to parse JSON
try:
    data = response.json()
    print(f"JSON parse SUCCESS")
    print(f"Content: {data['choices'][0]['message']['content'][:200]}")
except Exception as e:
    print(f"JSON parse FAILED: {e}")