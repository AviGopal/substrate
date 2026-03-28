import sys

# Read the file
with open('/src/app/server/routes/learning_loop.py', 'r') as f:
    lines = f.readlines()

# Find the line with org_id = api_key_record["org_id"]
new_lines = []
for i, line in enumerate(lines):
    new_lines.append(line)
    if 'org_id = api_key_record["org_id"]' in line and 'user_id = api_key_record.get("user_id")' not in ''.join(lines[i:i+10]):
        # Add user extraction code after this line
        indent = ' ' * 24  # Match the indentation
        new_lines.append(f'{indent}user_id = api_key_record.get("user_id")\n')
        new_lines.append(f'{indent}if user_id:\n')
        new_lines.append(f'{indent}    from server.db.operations.user_ops import get_user\n')
        new_lines.append(f'{indent}    user_record = await get_user(user_id)\n')
        new_lines.append(f'{indent}    if user_record:\n')
        new_lines.append(f'{indent}        user_email = user_record.get("email")\n')

# Write back
with open('/src/app/server/routes/learning_loop.py', 'w') as f:
    f.writelines(new_lines)

print("API key user extraction added")
