target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'
with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

old = 'def generate_caption(date_str: str, image_ids: List[int], set_type: str = "xiaohongshu", user_instructions: Optional[str] = None) -> Dict:'
new = 'def generate_caption(date_str: str, image_ids: List[int], set_type: str = "xiaohongshu", user_instructions: Optional[str] = None, llm_model: str = "local") -> Dict:'

if old in content:
    content = content.replace(old, new)
    with open(target, 'w', encoding='utf-8') as f:
        f.write(content)
    # Verify syntax
    try:
        compile(content, target, 'exec')
        print("SUCCESS: Bug 1 fixed. Syntax OK.")
    except SyntaxError as e:
        print(f"ERROR: Syntax error: {e}")
else:
    if 'llm_model' in content[content.find('def generate_caption'):content.find('def generate_caption')+150]:
        print("Already fixed: generate_caption has llm_model param")
    else:
        print("ERROR: Pattern not found")
