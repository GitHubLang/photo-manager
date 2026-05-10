import json

# Test what the JSON looks like
data = {"folders": [
    {"path": "E:\\图像\\练习", "name": "练习"},
    {"path": "E:\\图像\\导出", "name": "导出"}
]}

# ensure_ascii=False keeps Chinese as-is
json_str = json.dumps(data, ensure_ascii=False)
print("JSON with ensure_ascii=False:")
print(json_str)
print()
print("Bytes:")
print(json_str.encode("utf-8").hex())
