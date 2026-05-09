import mysql.connector
conn = mysql.connector.connect(host='192.168.X.X',user='root',password='REDACTED',database='photo_manager_db')
cur = conn.cursor()

cur.execute("SELECT DISTINCT folder_path FROM images WHERE folder_path LIKE '%导出%' ORDER BY folder_path")
print('Export folders:')
for r in cur:
    print(f'  {r[0]}')

cur.execute("SELECT folder_path, COUNT(*) as cnt FROM images WHERE folder_path LIKE '%导出%' GROUP BY folder_path ORDER BY cnt DESC LIMIT 20")
print()
print('Export counts:')
for r in cur:
    print(f'  {r[0]}: {r[1]}张')

# Also check some sample filenames in each
cur.execute("SELECT folder_path, filename FROM images WHERE folder_path LIKE '%导出%' LIMIT 30")
print()
print('Sample filenames:')
for r in cur:
    print(f'  {r[0]} -> {r[1]}')

cur.close()
conn.close()
