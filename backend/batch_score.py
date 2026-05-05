# -*- coding: utf-8 -*-
"""
批量评分 - MiniMax, 4并发, 批次间隔5秒
"""
import sys, os, io, time, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from database import execute_query
from services.llm_scorer import score_and_describe_image

FOLDER = r'E:\图像\导出'
MODEL = 'MiniMax-2.7'
CONCURRENCY = 4
BATCH_DELAY = 5  # seconds between batches

def get_unscored():
    return execute_query("""
        SELECT i.id, i.file_path FROM images i
        WHERE i.folder_path = %s
          AND i.id NOT IN (SELECT image_id FROM image_scores)
        ORDER BY i.filename
    """, (FOLDER,))

def process_one(iid, ipath):
    name = os.path.basename(ipath)
    try:
        r = score_and_describe_image(iid, ipath, MODEL)
        ok = r.get('scored', False)
        tag = "[OK]" if ok else "[FAIL]"
        print("%s %d %s" % (tag, iid, name))
        return ok
    except Exception as e:
        print("[FAIL] %d %s: %s" % (iid, name, e))
        return False

def main():
    images = get_unscored()
    total = len(images)
    if total == 0:
        print("All scored!")
        return

    print("Unscored: %d, concurrency: %d, model: %s" % (total, CONCURRENCY, MODEL))
    ok = 0
    fail = 0

    for i in range(0, total, CONCURRENCY):
        batch = images[i:i+CONCURRENCY]
        idx = i // CONCURRENCY + 1
        total_batches = (total + CONCURRENCY - 1) // CONCURRENCY
        print("\n--- Batch %d/%d (%d images) ---" % (idx, total_batches, len(batch)))

        threads = []
        for img in batch:
            t = threading.Thread(target=lambda iid=img['id'], ip=img['file_path']: None, daemon=True)
            threads.append(t)

        # Use a result collector
        results = []
        sem = threading.Semaphore(0)

        def worker(iid, ipath):
            r = process_one(iid, ipath)
            results.append(r)
            sem.release()

        for img in batch:
            t = threading.Thread(target=worker, args=(img['id'], img['file_path']), daemon=True)
            t.start()

        # Wait for all threads
        for _ in batch:
            sem.acquire()

        ok += sum(1 for r in results if r)
        fail += sum(1 for r in results if not r)
        results.clear()

        if i + CONCURRENCY < total:
            time.sleep(BATCH_DELAY)

    print("\nDone! OK=%d FAIL=%d Total=%d" % (ok, fail, total))

if __name__ == '__main__':
    main()
