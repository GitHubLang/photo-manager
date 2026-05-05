import subprocess

repo = r'D:\MySoftware\photo-manager'

# Extract clean content from 6eeb1c73
p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
text = out.decode('utf-8')
lines = text.split('\n')

# Print lines 235-270 (generate_caption function)
print("=== generate_caption function (lines 235-270) ===")
for i, l in enumerate(lines[234:270], 235):
    print(f'{i}: {l}')
