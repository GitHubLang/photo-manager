import subprocess
from io import BytesIO

repo = r'D:\MySoftware\photo-manager'

p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
text = out.decode('utf-8')

# Find the function definitions we care about
for keyword in ['def generate_caption', 'def generate_daily_theme', 'INSERT INTO photo_sets', '"model": LOCAL_LLM_MODEL']:
    idx = text.find(keyword)
    if idx >= 0:
        line_num = text[:idx].count('\n') + 1
        chunk = text[idx:idx+200]
        # Replace problematic chars for printing
        safe_chunk = chunk.encode('ascii', 'replace').decode('ascii')
        print(f'\n--- {keyword} at line {line_num} ---')
        print(safe_chunk[:150])
