target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'

with open(target, 'rb') as f:
    raw = f.read()

# Find INSERT
idx = raw.find(b'INSERT INTO photo_sets')
if idx >= 0:
    chunk = raw[idx:idx+800]
    print('Raw bytes around INSERT:')
    print(repr(chunk[:400]))
    print('...')
    
# Find execute_query
exec_idx = raw.find(b'execute_query', idx)
if exec_idx > idx:
    chunk2 = raw[exec_idx:exec_idx+400]
    print()
    print('Raw bytes around execute_query:')
    print(repr(chunk2))
