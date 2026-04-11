import os, sys

# Check filesystem encoding
print('Filesystem encoding:', sys.getfilesystemencoding())
print('Default encoding:', sys.getdefaultencoding())

# Check if the PHOTO_ROOT path exists
photo_root = r'E:\图像'
try:
    items = os.listdir(photo_root)
    print('Items in photo_root:')
    for item in items[:5]:
        # Show the actual Unicode codepoints
        cps = [hex(ord(c)) for c in item]
        print(f'  {item!r} -> codepoints: {cps}')
        # Also show the raw bytes if encoded in different ways
        print(f'    UTF-8 bytes: {item.encode("utf-8").hex()}')
        print(f'    GBK bytes: {item.encode("gbk").hex()}')
except Exception as e:
    print('Error:', e)
