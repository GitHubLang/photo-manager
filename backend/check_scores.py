import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import execute_query

# Get actual path from DB
r = execute_query("SELECT folder_path FROM images WHERE folder_path LIKE %s LIMIT 1", ('%导出%',))
actual_path = r[0]['folder_path'] if r else None
print("Actual path:", repr(actual_path))

# Count total and scored for that path
total = execute_query("SELECT COUNT(*) as c FROM images WHERE folder_path = %s", (actual_path,))
print("Total:", total[0]['c'])

scored = execute_query("SELECT COUNT(DISTINCT i.id) as c FROM images i JOIN image_scores s ON i.id=s.image_id WHERE i.folder_path = %s", (actual_path,))
print("Scored:", scored[0]['c'])
print("Unscored:", total[0]['c'] - scored[0]['c'])
