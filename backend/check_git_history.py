import subprocess

# Get the file content from git using Windows git, write to temp location
# Use BytesIO to avoid filesystem
from io import BytesIO

# Find Windows git
p = subprocess.Popen(
    ['where', 'git'],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
out, err = p.communicate()
print('where git output:', out.decode('utf-8', errors='replace'))

# Try git cat-file --batch
repo = r'D:\MySoftware\photo-manager'
commit = '9b465936'
filepath_in_git = 'backend/services/daily_theme.py'

# Get the blob SHA of the file at that commit
p2 = subprocess.Popen(
    ['git', '-C', repo, 'ls-tree', commit, '--', filepath_in_git],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)
tree_out, tree_err = p2.communicate()
print('ls-tree output:', tree_out.decode('utf-8', errors='replace'))
# tree_out looks like: 100644 blob a1b2c3...    daily_theme.py
parts = tree_out.decode('utf-8', errors='replace').strip().split()
if len(parts) >= 3:
    blob_sha = parts[2]
    print('Blob SHA:', blob_sha)
    
    # Get the blob content
    p3 = subprocess.Popen(
        ['git', '-C', repo, 'cat-file', '-p', blob_sha],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    blob_out, blob_err = p3.communicate()
    print('Blob first 100 bytes:', repr(blob_out[:100]))
    print('Has nulls in blob:', b'\x00' in blob_out[:200])
