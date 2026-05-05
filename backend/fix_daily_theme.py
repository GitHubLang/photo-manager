#!/usr/bin/env python3
"""修复 daily_theme.py 的所有 bug，保留原编码"""
import sys

filepath = sys.argv[1]
with open(filepath, 'rb') as f:
    raw = f.read()

try:
    content = raw.decode('utf-8')
except UnicodeDecodeError:
    content = raw.decode('latin-1')

original = content
changes = []

# ========== Bug 1: generate_caption hardcodes LOCAL_LLM_MODEL ==========
old_block1 = '''        payload = {
            "model": LOCAL_LLM_MODEL,
            "messages": messages,
            "max_tokens": 2048,
            "temperature": 0.5,
        }
        
        response = requests.post(
            f"{LOCAL_LLM_API}/v1/chat/completions",
            json=payload,
            timeout=120
        )'''

new_block1 = '''        messages = [{"role": "user", "content": prompt}]
        
        if llm_model == "local":
            payload = {
                "model": LOCAL_LLM_MODEL,
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.5,
            }
            response = requests.post(
                f"{LOCAL_LLM_API}/v1/chat/completions",
                json=payload,
                timeout=120
            )
        else:
            row = execute_query(
                "SELECT api_endpoint, api_key, model_name FROM models WHERE name=%s AND model_type='chat' LIMIT 1",
                (llm_model,), fetch=True
            )
            if not row:
                raise ValueError(f"Model '{llm_model}' not found in database")
            ext_api, ext_key, ext_model_name = row[0]
            ext_payload = {
                "model": ext_model_name,
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.5,
            }
            headers = {}
            if ext_key:
                headers["Authorization"] = f"Bearer {ext_key}"
            response = requests.post(
                ext_api,
                json=ext_payload,
                headers=headers,
                timeout=120
            )'''

if old_block1 in content:
    content = content.replace(old_block1, new_block1)
    changes.append("Bug 1: generate_caption hardcoded -> conditional llm_model")
else:
    print("WARNING: Bug 1 pattern not found", file=sys.stderr)

# ========== Bug 2: SQL 7 columns but 8 values ==========
old_sql = '''            save_sql = """
                INSERT INTO photo_sets (date, set_type, cover_image_id, caption_title, 
                                      caption_body, hashtags, image_ids)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            execute_query(save_sql, (
                effective_date,
                set_type,
                cover_id,
                caption_data.get("title", ""),
                caption_data.get("content") or caption_data.get("description", ""),
                caption_data.get("hashtags", ""),
                json.dumps(image_ids),
                llm_model
            ), fetch=False)'''

new_sql = '''            save_sql = """
                INSERT INTO photo_sets (date, set_type, cover_image_id, caption_title,
                                      caption_body, hashtags, image_ids)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            execute_query(save_sql, (
                effective_date,
                set_type,
                cover_id,
                caption_data.get("title", ""),
                caption_data.get("content") or caption_data.get("description", ""),
                caption_data.get("hashtags", ""),
                json.dumps(image_ids)
            ), fetch=False)'''

if old_sql in content:
    content = content.replace(old_sql, new_sql)
    changes.append("Bug 2: SQL 8 placeholders/8 values -> 7 placeholders/7 values")
else:
    print("WARNING: Bug 2 pattern not found", file=sys.stderr)

# ========== Bug 3: generate_daily_theme missing llm_model parameter ==========
old_func_sig = "def generate_daily_theme(date_str: str) -> Dict:"
new_func_sig = "def generate_daily_theme(date_str: str, llm_model: str = \"local\") -> Dict:"

if old_func_sig in content:
    content = content.replace(old_func_sig, new_func_sig)
    changes.append("Bug 3: generate_daily_theme add llm_model parameter")
else:
    print("WARNING: Bug 3 pattern not found", file=sys.stderr)

if not changes:
    print("ERROR: No bugs fixed, file may already be fixed", file=sys.stderr)
    sys.exit(1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS:")
for c in changes:
    print(f"  + {c}")
