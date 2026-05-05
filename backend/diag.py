target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'
with open(target, 'rb') as f:
    raw = f.read()
content = raw.decode('utf-8', errors='replace')

print(f"File size: {len(raw)} bytes")

# Check INSERT params
idx = content.find('INSERT INTO photo_sets')
ex_idx = content.find('execute_query', idx)
params = content[ex_idx:ex_idx+400]
print("\n--- INSERT params section ---")
for line in params.split('\n')[:15]:
    print(repr(line))

# Check for llm_model in params
has_llm = 'llm_model' in params
print(f"\nHas llm_model in params: {has_llm}")

# Count placeholders in INSERT
insert_chunk = content[idx:idx+200]
ph_count = insert_chunk.count('%s')
print(f"Placeholders in INSERT: {ph_count}")

# Check function signatures
for func in ['def generate_caption', 'def generate_daily_theme']:
    idx2 = content.find(func)
    if idx2 >= 0:
        sig = content[idx2:idx2+120].split('\n')[0]
        has_param = 'llm_model' in sig
        print(f"\n{func}: {sig}")
        print(f"  Has llm_model param: {has_param}")
