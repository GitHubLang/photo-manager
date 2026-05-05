import subprocess
import os

os.chdir(r'D:\MySoftware\photo-manager')

# Extract file from git using git cat-file (pipe bytes, no filesystem)
p1 = subprocess.Popen(
    ['git', 'cat-file', '-p', '9b465936:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
stdout, stderr = p1.communicate()
print('git cat-file returncode:', p1.returncode)
print('First 100 bytes:', repr(stdout[:100]))
print('Contains nulls:', b'\x00' in stdout[:200])

# Write directly to file
target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'
with open(target, 'wb') as f:
    f.write(stdout)
print('Written to', target)

# Verify
with open(target, 'rb') as f:
    verify = f.read(100)
print('Verify first 100 bytes:', repr(verify))
print('Contains wsl prefix:', b'wsl:' in verify)
