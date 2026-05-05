import sys
sys.path.insert(0, 'D:/MySoftware/photo-manager/backend')

from services.daily_theme import generate_caption

# Test with MiniMax-2.7
result = generate_caption("2026-04-15", [1], "douyin", llm_model="MiniMax-2.7")
print("Result:", result)