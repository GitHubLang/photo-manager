import requests
import base64
from PIL import Image
import io

img = Image.new('RGB', (100, 100), color='red')
buf = io.BytesIO()
img.save(buf, format='JPEG')
b64 = base64.b64encode(buf.getvalue()).decode()

url = 'http://192.168.71.55:1234/v1/chat/completions'
SCORING_PROMPT = """你是一位专业摄影比赛评委。请根据专业摄影比赛标准对这张照片进行评分。
对每个维度，请提供：分数(0-100)、详细分析、具体改进建议。
请按以下精确JSON格式返回分析结果（只返回JSON，不要其他内容）：
{
  "impact": {"score": 0-100, "analysis": "冲击力的详细分析", "suggestion": "具体改进建议"}
}
请开始评分："""

payload = {
    'model': 'google/gemma-4-26b-a4b',
    'messages': [{
        'role': 'user',
        'content': [
            {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{b64}'}},
            {'type': 'text', 'text': SCORING_PROMPT}
        ]
    }],
    'max_tokens': 1000
}
r = requests.post(url, json=payload, timeout=60)
result = r.json()
msg = result['choices'][0]['message']
print('content type:', type(msg.get('content')))
print('content:', msg.get('content', '')[:500])
