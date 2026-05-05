# -*- coding: utf-8 -*-
"""
批量评分 - MiniMax, 4并发, 导出目录
"""
import sys, os, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# Force UTF-8 output (Windows redirect)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from database import execute_query
from services.llm_scorer import score_and_describe_image
import threading

FOLDER = r'E:\图像\导出'
CONCURRENCY = 4
MODEL = 'MiniMax-2.7'

def get_unscored():
    rows = execute_query("""
        SELECT i.id, i.file_path FROM images i
        WHERE i.folder_path = %s
          AND i.id NOT IN (SELECT image_id FROM image_scores)
        ORDER BY i.filename
    """, (FOLDER,))
    return rows

def process_batch(batch, sem):
    for img in batch:
        sem.acquire()
        def worker(iid=img['id'], ipath=img['file_path']):
            try:
                name = os.path.basename(ipath)
                print("[%s] Scoring %d: %s" % (threading.current_thread().name, iid, name))
                r = score_and_describe_image(iid, ipath, MODEL)
                if r.get('scored'):
                    print("  [OK] %d scored" % iid)
                else:
                    print("  [FAIL] %d score failed" % iid)
                if r.get('described'):
                    print("  [OK] %d described" % iid)
            except Exception as e:
                print("  [ERR] %d: %s" % (iid, e))
            finally:
                sem.release()
        t = threading.Thread(target=worker, daemon=True)
        t.start()

def main():
    images = get_unscored()
    total = len(images)
    print("Unscored: %d, concurrency: %d, model: %s" % (total, CONCURRENCY, MODEL))
    if total == 0:
        print("All scored!")
        return

    sem = threading.Semaphore(CONCURRENCY)
    for i in range(0, total, CONCURRENCY):
        batch = images[i:i+CONCURRENCY]
        idx = i // CONCURRENCY + 1
        total_batches = (total + CONCURRENCY - 1) // CONCURRENCY
        print("\n--- Batch %d/%d (%d images) ---" % (idx, total_batches, len(batch)))
        process_batch(batch, sem)
        for _ in range(len(batch)):
            sem.acquire()
        for _ in range(len(batch)):
            sem.release()

    print("\nDone! Processed %d images" % total)

if __name__ == '__main__':
    main()
