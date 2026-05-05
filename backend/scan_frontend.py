import os

frontend = r'D:\MySoftware\photo-manager\frontend\src'
dirty = []
for root, dirs, files in os.walk(frontend):
    for fn in files:
        if fn.endswith(('.js', '.jsx', '.ts', '.tsx', '.css')):
            path = os.path.join(root, fn)
            with open(path, 'rb') as f:
                data = f.read()
            nulls = data.count(b'\x00')
            if nulls > 0:
                dirty.append((path, nulls, len(data)))

for path, nulls, size in sorted(dirty, key=lambda x: -x[1]):
    print(f"DIRTY  {nulls:4d} nulls  {size:6d} bytes  {path}")
