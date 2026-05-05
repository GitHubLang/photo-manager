import subprocess

target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'

with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

# Find INSERT and look at the raw bytes around params
idx = content.find('INSERT INTO photo_sets')
chunk = content[idx:idx+600]

# Find execute_query after INSERT
exec_idx = content.find('execute_query', idx)
params_section = content[exec_idx:exec_idx+300]

# Check for llm_model
has_llm = 'llm_model' in params_section
print(f'has llm_model in params: {has_llm}')
print(f'exec_idx: {exec_idx}')
print(f'INSERT idx: {idx}')
print()
print('Params section:')
for line in params_section.split('\n'):
    print(' |', line)
