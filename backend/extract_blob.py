import subprocess
from io import BytesIO

repo = r'D:\MySoftware\photo-manager'

# Check recent commit history for this file
p = subprocess.Popen(
    ['git', '-C', repo, 'log', '--oneline', '--all', '-20', '--', 'backend/services/daily_theme.py'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
out, err = p.communicate()
print('Git history for daily_theme.py:')
print(out.decode('utf-8', errors='replace'))

# Get the first commit that introduced this file
p2 = subprocess.Popen(
    ['git', '-C', repo, 'log', '--reverse', '--format=%H %s', '-5', '--', 'backend/services/daily_theme.py'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
out2, err2 = p2.communicate()
print('First few commits:')
print(out2.decode('utf-8', errors='replace'))
