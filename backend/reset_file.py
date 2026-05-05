import subprocess
import os

os.chdir(r'D:\MySoftware\photo-manager')

# Use Windows git to checkout the file
result = subprocess.run(
    ['git', 'checkout', '9b465936', '--', 'backend/services/daily_theme.py'],
    capture_output=True, text=True
)
print('stdout:', result.stdout)
print('stderr:', result.stderr)
print('returncode:', result.returncode)

# Verify file is clean
f = open(r'D:\MySoftware\photo-manager\backend\services\daily_theme.py', 'rb')
data = f.read(300)
f.close()
print('First 300 bytes:', repr(data))
