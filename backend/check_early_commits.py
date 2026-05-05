import subprocess

repo = r'D:\MySoftware\photo-manager'

# Check earliest clean commit
for commit in ['33d07c2b', '0a7dff83', '6eeb1c73']:
    p = subprocess.Popen(
        ['git', '-C', repo, 'cat-file', '-p', f'{commit}:backend/services/daily_theme.py'],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE
    )
    out, err = p.communicate()
    has_null = b'\x00' in out[:300]
    first_bytes = repr(out[:50])
    print(f'{commit}: nulls={has_null}, first50={first_bytes}')
    if not has_null:
        # Try to decode as utf-8
        try:
            text = out.decode('utf-8')
            # Check if it's actually readable
            if 'def generate_caption' in text:
                print(f'  -> CLEAN! Has generate_caption function')
            else:
                print(f'  -> No generate_caption found')
        except:
            print(f'  -> UTF-8 decode failed')
