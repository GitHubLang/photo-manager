#!/usr/bin/env python3
target_file = '/mnt/d/MySoftware/photo-manager/backend/services/daily_theme.py'
with open(target_file, 'rb') as f:
    data = f.read()
idx = data.find(b'response = requests.post(api_url, headers=headers')
if idx < 0:
    print("ERROR: MiniMax requests.post not found!")
    exit(1)
block_start = data.rfind(b'if model_config:', 0, idx)
else_pos = data.find(b'else:', idx)
print(f"Found at block_start={block_start}, idx={idx}, else_pos={else_pos}")

ERR1 = "\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u6dfb\u52a0\u6a21\u578b\u914d\u7f6e".encode('utf-8')
ERR2 = "\u9519\u8bef".encode('utf-8')
ERR3 = "\u8c03\u7528\u5931\u8d25".encode('utf-8')
ERR4 = "MiniMax API Key \u672a\u914d\u7f6e\uff0c\u8bf7\u5728\u8bbe\u7f6e\u4e2d\u6dfb\u52a0\u6a21\u578b\u914d\u7f6e".encode('utf-8')

new_block = (
    b'        if model_config:\n'
    b'            cfg = model_config[0]\n'
    b'            api_url = cfg["api_endpoint"]\n'
    b'            api_key = cfg["api_key"] or MINIMAX_API_KEY\n'
    b'            model_name = cfg["model_name"]\n'
    b'            headers = {}\n'
    b'            if api_key:\n'
    b'                headers["Authorization"] = f"Bearer {api_key}"\n'
    b'            payload = {\n'
    b'                "model": model_name,\n'
    b'                "messages": messages,\n'
    b'                "max_tokens": 2048,\n'
    b'                "temperature": 0.5,\n'
    b'            }\n'
    b'\n'
    b'            if not api_key:\n'
    b'                return {"success": False, "error": "MiniMax API Key ' + ERR4 + b'"}\n'
    b'\n'
    b'            try:\n'
    b'                response = requests.post(api_url, headers=headers, json=payload, timeout=120)\n'
    b'                if response.status_code != 200:\n'
    b'                    try:\n'
    b'                        err_data = response.json()\n'
    b'                        err_msg = err_data.get("error", {}).get("message", "") or f"HTTP {response.status_code}"\n'
    b'                    except Exception:\n'
    b'                        err_msg = f"HTTP {response.status_code}"\n'
    b'                    return {"success": False, "error": "MiniMax API ' + ERR2 + b': " + err_msg}\n'
    b'                result = response.json()\n'
    b'            except Exception as e:\n'
    b'                return {"success": False, "error": "MiniMax API ' + ERR3 + b': " + str(e)}\n'
)

new_data = data[:block_start] + new_block + data[else_pos:]
try:
    compile(new_data.decode('utf-8'), target_file, 'exec')
    print("Syntax check PASSED")
except SyntaxError as e:
    print(f"Syntax check FAILED: {e}")
    exit(1)
with open(target_file, 'wb') as f:
    f.write(new_data)
print(f"Fix applied! Old: {len(data)}, New: {len(new_data)}")
