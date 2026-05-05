import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import execute_query
from services.llm_scorer import score_and_describe_image

img = execute_query(
    "SELECT id, file_path FROM images WHERE folder_path = %s AND id NOT IN (SELECT image_id FROM image_scores) ORDER BY filename LIMIT 1",
    (r'E:\图像\导出',)
)
if img:
    i = img[0]
    print("Testing image %d: %s" % (i['id'], i['file_path']))
    r = score_and_describe_image(i['id'], i['file_path'], 'MiniMax-2.7')
    print("Scored:", r.get('scored'))
    if r.get('scored'):
        print("Total:", r.get('scores', {}).get('total'))
    print("Described:", r.get('described'))
else:
    print("No unscored images!")
