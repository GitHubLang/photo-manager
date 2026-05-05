import subprocess

# Verify the file on disk is clean
target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'
with open(target, 'rb') as f:
    data = f.read()

print('File size on disk:', len(data))
print('Has null bytes:', b'\x00' in data[:300])
print('First 50 bytes:', repr(data[:50]))

# Try to parse as Python
try:
    compile(data.decode('utf-8'), target, 'exec')
    print('SYNTAX: OK')
except SyntaxError as e:
    print('SYNTAX ERROR:', e)

# Count functions
text = data.decode('utf-8', errors='replace')
print('Has def generate_caption:', 'def generate_caption' in text)
print('Has def generate_daily_theme:', 'def generate_daily_theme' in text)

# Check llm_model param in generate_caption
idx = text.find('def generate_caption')
if idx >= 0:
    chunk = text[idx:idx+200]
    print('generate_caption signature:', chunk.split('\n')[0])
