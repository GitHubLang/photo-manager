#!/usr/bin/env python3
# This script replaces the MiniMax API call block in daily_theme.py
# with proper error handling

import re

with open('services/daily_theme.py', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# The target: the requests.post for minimax (inside the if model_config block)
# Line 342: response = requests.post(api_url, headers=headers, json=payload, timeout=120)
# We need to replace this single line with a proper error-handling block

old_line = '            response = requests.post(api_url, headers=headers, json=payload, timeout=120)'

# Find this line
if old_line not in content:
    print(f"ERROR: Could not find: {repr(old_line)}")
    exit(1)

idx = content.find(old_line)
print(f"Found target at position {idx}")
print(f"Context: {repr(content[idx-100:idx+200])}")

# The new block to insert INSTEAD of the old line
new_block = '''            if not api_key:
                return {"success": False, "error": "MiniMax API Key 未配置，请在设置中添加模型配置"}

            try:
                response = requests.post(api_url, headers=headers, json=payload, timeout=120)
                if response.status_code != 200:
                    try:
                        err_data = response.json()
                        err_msg = err_data.get("error", {}).get("message", "") or f"HTTP {response.status_code}"
                    except Exception:
                        err_msg = f"HTTP {response.status_code}"
                    return {"success": False, "error": f"MiniMax API 错误: {err_msg}"}
            except Exception as e:
                return {"success": False, "error": f"MiniMax API 调用失败: {str(e)}"}
'''

new_content = content.replace(old_line, new_block, 1)

# Verify syntax
try:
    compile(new_content, 'services/daily_theme.py', 'exec')
    print("Syntax check PASSED")
except SyntaxError as e:
    print(f"Syntax check FAILED: {e}")
    exit(1)

with open('services/daily_theme.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Fix applied successfully!")
