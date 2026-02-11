# Memory Stress Test Activity

This activity is designed to exercise memory-intensive operations to identify memory leaks.

## Objective

Execute a series of operations that are known to allocate memory:
1. File operations (read/write multiple files)
2. Git operations (status, diff, log)
3. Tool invocations (metabob if available)
4. Session state management

## Steps

### Step 1: Create Multiple Test Files

Create 10 test files with varying content sizes to exercise file handling:

```bash
for i in {1..10}; do
  echo "Test file $i with some content" > "/tmp/test_file_$i.txt"
  echo "Line 2 of test file $i" >> "/tmp/test_file_$i.txt"
  echo "Line 3 of test file $i" >> "/tmp/test_file_$i.txt"
done
```

### Step 2: Read Files Back

Read all created files to exercise file system operations:

```bash
for i in {1..10}; do
  cat "/tmp/test_file_$i.txt"
done
```

### Step 3: Git Operations

Run git commands that may load repository data:

```bash
git status
git log --oneline -10
git diff HEAD~1 HEAD --stat
```

### Step 4: Simulate Tool Calls

Simulate tool operations that would allocate memory:

```bash
# List files (simulates glob operations)
find . -name "*.ts" -type f | head -20

# Grep operation (simulates code search)
grep -r "function" --include="*.ts" . 2>/dev/null | head -20 || true
```

### Step 5: Cleanup

Remove test files:

```bash
rm -f /tmp/test_file_*.txt
```

## Expected Behavior

- Memory should increase during file operations
- Memory should be released after cleanup
- No persistent memory growth across iterations

## Success Criteria

- All files created and read successfully
- Git commands execute without error
- Test files cleaned up
- Memory returns to baseline after completion
