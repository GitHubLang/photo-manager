import sys
sys.path.insert(0, r'D:\MySoftware\photo-manager\backend')
import os
os.chdir(r'D:\MySoftware\photo-manager\backend')

from database import execute_query

img = execute_query("SELECT id, file_path, filename FROM images WHERE id = 7197")
print("Image 7197:", img)

if img:
    fp = img[0]['file_path']
    print(f"file_path: {fp}")
    print(f"exists: {os.path.exists(fp)}")
    
    # Try to open with PIL and see exact error
    from PIL import Image as PILImage
    try:
        with open(fp, 'rb') as f:
            header = f.read(16)
            print(f"File header (hex): {header.hex()}")
        img2 = PILImage.open(fp)
        print(f"PIL opened OK, mode={img2.mode}, size={img2.size}")
    except Exception as e:
        print(f"Error: {type(e).__name__}: {e}")
        
    # Check file size
    size = os.path.getsize(fp)
    print(f"File size: {size} bytes")
