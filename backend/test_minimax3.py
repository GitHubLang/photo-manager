import requests
import json

api_key = "sk-cp-Lff7Uhdj1f1dr4Q7nshJ71S4p-taKTcDomWnQCmE8TYdHrcDPyqCr5h7KjnP1x1dIcGLYqa9fXq5soIyTFuVQYxgUuCMY_IkV-nvrND1suI2QtyITHJdpT8"
api_url = "https://api.minimax.chat/v1/chat/completions"

payload = {
    "model": "MiniMax-M2.7",
    "messages": [{"role": "user", "content": "say hi"}],
    "max_tokens": 50
}

headers = {"Authorization": f"Bearer {api_key}"}
response = requests.post(api_url, headers=headers, json=payload, timeout=30)
print(f"Status: {response.status_code}")
data = response.json()
print(f"Model: {data.get('model')}")
print(f"Choice content: {data['choices'][0]['message']['content'][:100]}")