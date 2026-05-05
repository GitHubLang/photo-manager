f = open(r'D:\MySoftware\photo-manager\backend\services\daily_theme.py', 'rb')
data = f.read()
f.close()

# Find the INSERT context
idx = data.find(b'INSERT INTO photo_sets')
if idx >= 0:
    # Print 500 bytes around it
    chunk = data[idx:idx+500]
    # Count %s
    count = chunk.count(b'%s')
    print(f'INSERT context (%s count={count}):')
    try:
        text = chunk.decode('utf-8')
    except:
        text = chunk.decode('latin-1')
    for line in text.split('\r\n'):
        print(line)
    print('---')
    # Also find the execute_query call after this
    idx2 = data.find(b'execute_query', idx)
    if idx2 > 0:
        chunk2 = data[idx2:idx2+300]
        try:
            text2 = chunk2.decode('utf-8')
        except:
            text2 = chunk2.decode('latin-1')
        print('execute_query call:')
        for line in text2.split('\r\n'):
            print(line)
