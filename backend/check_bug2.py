import subprocess

target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'

with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('INSERT INTO photo_sets')
exec_idx = content.find('execute_query', idx)
params_start = content.find('(effective_date', exec_idx)

output = []
output.append(f'INSERT at: {idx}')
output.append(f'execute_query at: {exec_idx}')
output.append(f'params at: {params_start}')

if params_start > 0:
    chunk = content[params_start:params_start+300]
    # Count actual parameters
    lines_around = content[exec_idx:params_start+200]
    output.append(f'exec->params section length: {len(lines_around)}')
    output.append(f'llm_model in params: {"llm_model" in content[params_start:params_start+200]}')

with open(r'D:\temp_debug.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print('Debug info written')
