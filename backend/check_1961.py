import subprocess

repo = r'D:\MySoftware\photo-manager'

# Check 1961e1d4 which is the "模型配置管理" commit
p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '1961e1d4:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
text = out.decode('utf-8')

# Find generate_caption and generate_daily_theme
idx = text.find('def generate_caption')
if idx >= 0:
    sig = text[idx:text.find('\n', idx)]
    print('generate_caption signature:', sig)
    # Check for llm_model param
    if 'llm_model' in sig:
        print('  -> HAS llm_model param')
    else:
        print('  -> NO llm_model param')

# Check SQL INSERT
insert_idx = text.find('INSERT INTO photo_sets')
if insert_idx >= 0:
    chunk = text[insert_idx:insert_idx+400]
    placeholders = chunk.count('%s')
    print(f'\nINSERT placeholders: {placeholders}')
    # Find execute_query params after INSERT
    exec_idx = text.find('execute_query', insert_idx)
    if exec_idx >= 0:
        param_chunk = text[exec_idx:exec_idx+300]
        print('execute_query params:', repr(param_chunk[:200]))

# Check generate_daily_theme
sig2_idx = text.find('def generate_daily_theme')
if sig2_idx >= 0:
    sig2 = text[sig2_idx:sig2_idx+100].split('\n')[0]
    print(f'\ngenerate_daily_theme: {sig2}')
    if 'llm_model' in sig2:
        print('  -> HAS llm_model param')
    else:
        print('  -> NO llm_model param')

# Check for hardcoded LOCAL_LLM_MODEL
if '"model": LOCAL_LLM_MODEL' in text:
    idx2 = text.find('"model": LOCAL_LLM_MODEL')
    print(f'\nHardcoded LOCAL_LLM_MODEL at idx {idx2}:')
    print('Context:', repr(text[idx2-50:idx2+100]))
