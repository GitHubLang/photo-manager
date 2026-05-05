import subprocess
from io import BytesIO

repo = r'D:\MySoftware\photo-manager'

p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
text = out.decode('utf-8')
lines = text.split('\n')

# Print lines 12-80 (generate_daily_theme function)
print("=== generate_daily_theme (lines 12-80) ===")
for i, l in enumerate(lines[11:80], 12):
    safe = l.encode('ascii', 'replace').decode('ascii')
    print(f'{i}: {safe}')

print("\n=== INSERT INTO photo_sets context ===")
insert_idx = text.find('INSERT INTO photo_sets')
# Get 20 lines around it
line_num = text[:insert_idx].count('\n')
for i, l in enumerate(lines[line_num-2:line_num+20], line_num-1):
    safe = l.encode('ascii', 'replace').decode('ascii')
    print(f'{i}: {safe}')
