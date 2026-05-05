import subprocess

repo = r'D:\MySoftware\photo-manager'
# Use the oldest clean commit: 33d07c2b
# But we want the latest version WITH llm_model support, which was 6eeb1c73
# 6eeb1c73 is also clean. Let's use that as the base and only fix the bugs.

# First restore from 33d07c2b to get a clean working file
target_path = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'

p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()

with open(target_path, 'wb') as f:
    f.write(out)

print('File restored from 6eeb1c73')
print('Size:', len(out))

# Now verify it's clean
with open(target_path, 'rb') as f:
    verify = f.read(100)
print('First 100 bytes:', repr(verify))
