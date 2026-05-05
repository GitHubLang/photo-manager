# -*- coding: utf-8 -*-
"""
批量评分 - MiniMax, 1张/次, 间隔2秒, 失败重试1次
"""
import sys, os, io, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from database import execute_query
from services.llm_scorer import score_and_describe_image

FOLDER = r'E:\图像\导出'
MODEL = 'MiniMax-2.7'
DELAY = 3  # seconds between each image

def get_unscored():
    rows = execute_query("""
        SELECT i.id, i.file_path FROM images i
        WHERE i.folder_path = %s
          AND i.id NOT IN (SELECT image_id FROM image_scores)
        ORDER BY i.filename
    """, (FOLDER,))
    return rows

def process_one(iid, ipath):
    """Score one image, retry once on failure"""
    name = os.path.basename(ipath)
    for attempt in (1, 2):
        try:
            r = score_and_describe_image(iid, ipath, MODEL)
            if r.get('scored'):
                print("[OK] %d %s scored" % (iid, name))
                return True
            elif attempt == 1:
                print("[RETRY] %d %s" % (iid, name))
                time.sleep(5)
            else:
                print("[FAIL] %d %s" % (iid, name))
                return False
        except Exception as e:
            if attempt == 1:
                print("[RETRY] %d %s: %s" % (iid, name, e))
                time.sleep(5)
            else:
                print("[FAIL] %d %s: %s" % (iid, name, e))
                return False
    return False

def main():
    images = get_unscored()
    total = len(images)
    if total == 0:
        print("All scored!")
        return

    print("Unscored: %d, delay: %ds, model: %s" % (total, DELAY, MODEL))
    ok = 0
    fail = 0
    for idx, img in enumerate(images):
        iid, ipath = img['id'], img['file_path']
        name = os.path.basename(ipath)
        print("[%d/%d] %s ..." % (idx + 1, total, name), end=' ', flush=True)
        if process_one(iid, ipath):
            ok += 1
        else:
            fail += 1
        time.sleep(DELAY)

    print("\nDone! OK=%d FAIL=%d Total=%d" % (ok, fail, total))

if __name__ == '__main__':
    main()
