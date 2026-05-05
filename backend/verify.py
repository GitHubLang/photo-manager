target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'
with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File size: {len(content)} bytes")

# Check both function signatures
for func_name in ['def generate_caption', 'def generate_daily_theme']:
    idx = content.find(func_name)
    if idx >= 0:
        sig = content[idx:idx+160].split('\n')[0]
        print(f"\n{sig}")
        print(f"  llm_model param: {'llm_model' in sig}")

# Try to compile
try:
    compile(content, target, 'exec')
    print("\nSyntax: OK")
except SyntaxError as e:
    print(f"\nSyntax ERROR: {e}")

# Count %s in INSERT vs params
idx = content.find('INSERT INTO photo_sets')
ex_idx = content.find('execute_query', idx)
insert_block = content[idx:idx+300]
params_block = content[ex_idx:ex_idx+300]
print(f"\nINSERT placeholders: {insert_block.count('%s')}")
print(f"Params have llm_model: {'llm_model' in params_block}")
