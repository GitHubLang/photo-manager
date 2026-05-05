import sys
sys.path.insert(0, r'D:\MySoftware\photo-manager\backend')
import os
os.chdir(r'D:\MySoftware\photo-manager\backend')

from database import execute_query

# 查看最近失败的评分任务
print("=== 最近失败的任务 ===")
failed = execute_query("""
    SELECT id, image_id, status, error_message, created_at 
    FROM score_tasks 
    WHERE status = 'failed' 
    ORDER BY id DESC 
    LIMIT 10
""")
for t in failed:
    print(f"task_id={t['id']}, image_id={t['image_id']}, error={t['error_message']}")

print()
print("=== 查看有图片的记录 ===")
imgs = execute_query("SELECT id, file_path FROM images LIMIT 5")
for img in imgs:
    print(f"image_id={img['id']}, file_path={img['file_path']}")

print()
print("=== 检查文件是否存在 ===")
for img in imgs[:3]:
    fp = img['file_path']
    exists = os.path.exists(fp)
    print(f"{fp} -> exists={exists}")
