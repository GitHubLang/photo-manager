import mysql.connector
conn = mysql.connector.connect(host='192.168.X.X',user='root',password='REDACTED',database='photo_manager_db')
cur = conn.cursor()

cur.execute('SHOW TABLES')
print('tables:', [r[0] for r in cur])

cur.execute('SELECT COUNT(*) FROM images WHERE folder_path LIKE "%导出%"')
print('export images:', cur.fetchone()[0])

cur.execute('SELECT DISTINCT folder_path FROM images LIMIT 50')
print('folders:', [r[0] for r in cur])

cur.execute("DESCRIBE user_settings")
print('user_settings cols:', [(r[0], r[1]) for r in cur])

cur.execute('SELECT folder_path, COUNT(*) as cnt FROM images GROUP BY folder_path ORDER BY cnt DESC LIMIT 30')
for row in cur:
    print(f'  {row[0]}: {row[1]}张')

cur.close()
conn.close()
