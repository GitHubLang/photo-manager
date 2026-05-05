f = open(r'D:\MySoftware\photo-manager\backend\services\daily_theme.py', 'rb')
data = f.read()
f.close()
print('First 200 bytes:', repr(data[:200]))
idx = data.find(b'payload')
print('payload index:', idx)
if idx >= 0:
    print('Around payload:', repr(data[idx:idx+100]))
idx2 = data.find(b'INSERT INTO photo_sets')
print('INSERT index:', idx2)
if idx2 >= 0:
    print('INSERT context:', repr(data[idx2:idx2+200]))
