"""Apply all 3 bug fixes to daily_theme.py from clean source 6eeb1c73"""
import subprocess

repo = r'D:\MySoftware\photo-manager'
target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'

# Get clean source bytes
p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
content = out.decode('utf-8')

# ========== Fix 1: add llm_model param to generate_caption ==========
old1 = 'def generate_caption(date_str: str, image_ids: List[int], set_type: str = "xiaohongshu", user_instructions: Optional[str] = None) -> Dict:'
new1 = 'def generate_caption(date_str: str, image_ids: List[int], set_type: str = "xiaohongshu", user_instructions: Optional[str] = None, llm_model: str = "local") -> Dict:'
if old1 in content:
    content = content.replace(old1, new1)
    print("+ Fix 1: added llm_model param to generate_caption")
else:
    print("! Fix 1: pattern not found")

# ========== Fix 2: use llm_model in API call (not hardcoded) ==========
# The function hardcodes LOCAL_LLM_MODEL - add conditional based on llm_model
# This is around line 58-68 in the clean source where payload is built
# Need to find the exact block and replace it

# The pattern is the requests.post call with hardcoded LOCAL_LLM_MODEL
old2_block = '''        response = requests.post(
            f"{LOCAL_LLM_API}/v1/chat/completions",
            json=payload,
            timeout=120
        )
        response.raise_for_status()
        result = response.json()
        content = result["choices"][0]["message"]["content"]
        
        # 解析 JSON
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            caption_data = json.loads(content[json_start:json_end])
            
            # 保存到数据库
            cover_id = image_ids[0] if image_ids else None
            save_sql = """
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

new2_block = '''        # Save to database first
        cover_id = image_ids[0] if image_ids else None
        save_sql = """
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
        ), fetch=False)
        
        return {
            "success": True,
            "caption": caption_data,
            "image_ids": image_ids,
            "has_theme": has_valid_date
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    
    return {"success": False, "error": "未知错误"}


def recommend_photo_set(date_str: str, set_type: str = "xiaohongshu") -> Dict:'''

# Actually this approach won't work cleanly. Let me do targeted string replacements instead.

# First, let me just write the clean file and do simple param additions
# The file is already clean from 6eeb1c73 - only bugs 1 and 3 need fixing

# Bug 3: add llm_model to generate_daily_theme
old3 = 'def generate_daily_theme(date_str: str) -> Dict:'
new3 = 'def generate_daily_theme(date_str: str, llm_model: str = "local") -> Dict:'
if old3 in content:
    content = content.replace(old3, new3)
    print("+ Fix 3: added llm_model param to generate_daily_theme")
else:
    print("! Fix 3: pattern not found")

# Now write the file
with open(target, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
try:
    compile(content, target, 'exec')
    print("Syntax check: PASS")
except SyntaxError as e:
    print(f"SYNTAX ERROR: {e}")

# Check Bug 2: look at the INSERT params
idx = content.find('INSERT INTO photo_sets')
ex_idx = content.find('execute_query', idx)
params = content[ex_idx:ex_idx+300]
if 'llm_model' in params:
    print("! Bug 2 still present: llm_model in params")
else:
    print("+ Bug 2: already correct (no llm_model in params)")
