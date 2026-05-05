import subprocess

repo = r'D:\MySoftware\photo-manager'

p = subprocess.Popen(
    ['git', '-C', repo, 'show', '9b465936:backend/services/daily_theme.py'],
    stdout=subprocess.PIPE
)
out, _ = p.communicate()
has_nulls = b'\x00' in out[:500]
print(f'HEAD file size: {len(out)} bytes, has_nulls: {has_nulls}')

if has_nulls:
    print('HEAD is corrupted!')
else:
    text = out.decode('utf-8')
    sig_idx = text.find('def generate_caption')
    if sig_idx >= 0:
        sig = text[sig_idx:sig_idx+150].split('\n')[0]
        print(f'generate_caption: {sig}')
        has_llm = 'llm_model' in sig
        print(f'  -> llm_model param: {has_llm}')

    insert_idx = text.find('INSERT INTO photo_sets')
    if insert_idx >= 0:
        chunk = text[insert_idx:insert_idx+400]
        placeholders = chunk.count('%s')
        print(f'\nINSERT placeholders: {placeholders}')

    hard_idx = text.find('"model": LOCAL_LLM_MODEL')
    if hard_idx >= 0:
        line_num = text[:hard_idx].count('\n') + 1
        print(f'\nHardcoded LOCAL_LLM_MODEL at line ~{line_num}')
        print(f'Context: {repr(text[hard_idx-60:hard_idx+100])}')

    cond_idx = text.find('llm_model if llm_model')
    if cond_idx >= 0:
        print(f'\nConditional llm_model: {repr(text[cond_idx:cond_idx+80])}')

    func_sig = text.find('def generate_daily_theme')
    if func_sig >= 0:
        chunk = text[func_sig:func_sig+80].split('\n')[0]
        print(f'\ngenerate_daily_theme: {chunk}')
