import pymysql

conn = pymysql.connect(
    host='192.168.X.X',
    port=3306,
    user='root',
    password='*',
    database='photo_manager_db',
    charset='utf8mb4'
)
cursor = conn.cursor()
cursor.execute(
    "UPDATE models SET api_key=%s WHERE id=1",
    ('sk-cp-Lff7Uhdj1f1dr4Q7nshJ71S4p-taKTcDomWnQCmE8TYdHrcDPyqCr5h7KjnP1x1dIcGLYqa9fXq5soIyTFuVQYxgUuCMY_IkV-nvrND1suI2QtyITHJdpT8',)
)
conn.commit()
print('Updated:', cursor.rowcount)
conn.close()