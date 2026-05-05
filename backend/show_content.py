import subprocess

repo = r'D:\MySoftware\photo-manager'

p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
text = out.decode('utf-8')
lines = text.split('\n')

# Print lines around generate_caption function (starts around line 235)
for i, l in enumerate(lines[230:280], 231):
    print(f'{i}: {l}')
