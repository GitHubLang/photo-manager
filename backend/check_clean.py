import subprocess

repo = r'D:\MySoftware\photo-manager'

# Check 6eeb1c73 for bugs
p = subprocess.Popen(
    ['git', '-C', repo, 'cat-file', '-p', '6eeb1c73:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
text = out.decode('utf-8')

# Check Bug 1: hardcoded LOCAL_LLM_MODEL
if '"model": LOCAL_LLM_MODEL' in text and 'llm_model' in text:
    print('Bug 1 POSSIBLE: has both hardcoded LOCAL_LLM_MODEL and llm_model param')
    # Find the context
    idx = text.find('"model": LOCAL_LLM_MODEL')
    print('Context:', repr(text[idx-100:idx+100]))
elif '"model": LOCAL_LLM_MODEL' in text:
    print('Bug 1 PRESENT: hardcoded LOCAL_LLM_MODEL, no llm_model')
elif 'llm_model' in text:
    print('Bug 1 CHECK: has llm_model but not hardcoded LOCAL_LLM_MODEL')
else:
    print('Bug 1 ABSENT: no LOCAL_LLM_MODEL hardcode found')

# Check Bug 2: SQL placeholders
insert_idx = text.find('INSERT INTO photo_sets')
if insert_idx >= 0:
    chunk = text[insert_idx:insert_idx+300]
    placeholders = chunk.count('%s')
    print(f'Bug 2: INSERT has {placeholders} %s placeholders')
    # Find execute_query params
    exec_idx = text.find('execute_query', insert_idx)
    if exec_idx >= 0:
        param_chunk = text[exec_idx:exec_idx+200]
        print('Params context:', repr(param_chunk[:150]))

# Check Bug 3: generate_daily_theme signature
sig_idx = text.find('def generate_daily_theme')
if sig_idx >= 0:
    print('generate_daily_theme signature:', repr(text[sig_idx:sig_idx+80]))
    if 'llm_model' in text[sig_idx:sig_idx+80]:
        print('Bug 3 FIXED: has llm_model param')
    else:
        print('Bug 3 PRESENT: missing llm_model param')

# Print line count and size
print(f'\nFile size: {len(out)} bytes, ~{text.count(chr(10))} lines')
