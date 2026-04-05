from database import execute_query
import json

scores = execute_query("SELECT * FROM image_scores WHERE image_id = 3628")
print("=== image_scores ===")
print(json.dumps(scores, default=str, ensure_ascii=False))

descs = execute_query("SELECT * FROM image_descriptions WHERE image_id = 3628")
print("\n=== image_descriptions ===")
print(json.dumps(descs, default=str, ensure_ascii=False))

tasks = execute_query("SELECT * FROM score_tasks WHERE image_id = 3628 ORDER BY created_at DESC LIMIT 5")
print("\n=== score_tasks ===")
print(json.dumps(tasks, default=str, ensure_ascii=False))
