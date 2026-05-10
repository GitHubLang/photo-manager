from db import DB
import json

scores = DB.score_results_get(3628)
if not scores:
    scores = []
print("=== image_scores ===")
print(json.dumps(scores, default=str, ensure_ascii=False))

descs = ""
print("\n=== image_descriptions ===")
print(json.dumps(descs, default=str, ensure_ascii=False))

task_status = DB.score_tasks_get_status(3628)
print("\n=== score_tasks ===")
print(json.dumps(task_status or {}, default=str, ensure_ascii=False))
