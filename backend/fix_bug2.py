import re

target = r'D:\MySoftware\photo-manager\backend\services\daily_theme.py'

with open(target, 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# Bug 2: The execute_query call after INSERT has an extra llm_model parameter
# that doesn't match the 7-column INSERT
# Find pattern: after INSERT ... VALUES (%s, %s, %s, %s, %s, %s, %s) 
# followed by execute_query with ... json.dumps(image_ids), llm_model)

# Look for the specific pattern where llm_model appears at end of params
# The params are: effective_date, set_type, cover_id, title, content/desc, hashtags, json.dumps(image_ids), llm_model
# We need to remove the trailing , llm_model

# Use regex to find the specific execute_query call for this INSERT
# Pattern: execute_query(save_sql, (\n efffective_date...\n ..., \n llm_model\n), fetch=False)

# More precise: find the INSERT for photo_sets, then the execute_query after it
insert_pos = content.find('INSERT INTO photo_sets')
exec_pos = content.find('execute_query', insert_pos)

if exec_pos > insert_pos and exec_pos - insert_pos < 1000:
    # Get the params section
    # Find the opening ( after execute_query
    paren_start = content.find('(', exec_pos)
    # Find matching close paren
    depth = 1
    pos = paren_start + 1
    while pos < len(content) and depth > 0:
        if content[pos] == '(':
            depth += 1
        elif content[pos] == ')':
            depth -= 1
        pos += 1
    params_block = content[paren_start:pos]
    
    if 'llm_model' in params_block:
        # Remove llm_model from the end of params
        # It should be right before the last ))
        # Pattern: ,\n                llm_model\n            )
        old_end = ',\n                llm_model\n            )'
        new_end = '\n            )'
        if old_end in params_block:
            params_block = params_block.replace(old_end, new_end)
            # Reconstruct
            content = content[:paren_start] + params_block + content[pos:]
            print("Fixed: removed llm_model from params (pattern 1)")
        else:
            # Try without leading whitespace
            old_end2 = ', llm_model\n            )'
            new_end2 = '\n            )'
            if old_end2 in params_block:
                params_block = params_block.replace(old_end2, new_end2)
                content = content[:paren_start] + params_block + content[pos:]
                print("Fixed: removed llm_model from params (pattern 2)")
            else:
                # Find where llm_model appears in params
                llm_pos = params_block.find('llm_model')
                print(f"WARNING: llm_model at pos {llm_pos} in params block: {repr(params_block[-100:])}")
                # Try replacing just the trailing , llm_model
                old_pattern = re.compile(r',\s*llm_model\s*\n\s*\)')
                new_pattern = '\n            )'
                new_content, count = old_pattern.subn(new_pattern, params_block)
                if count > 0:
                    content = content[:paren_start] + new_content + content[pos:]
                    print(f"Fixed: regex removed llm_model ({count} replacements)")
                else:
                    print("ERROR: Could not fix Bug 2")
    else:
        print("Bug 2 already fixed or not present")
else:
    print("Could not find INSERT/execute_query pattern")

if content != original:
    with open(target, 'w', encoding='utf-8') as f:
        f.write(content)
    print("File written")
    
    # Verify syntax
    try:
        compile(content, target, 'exec')
        print("Syntax check: PASS")
    except SyntaxError as e:
        print(f"SYNTAX ERROR: {e}")
else:
    print("No changes made")
