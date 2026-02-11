# Simple Memory Test

Test basic operations.

## Steps

1. Echo test:
   ```bash
   echo "Iteration test at $(date)"
   ```

2. Create temp file:
   ```bash
   echo "test" > /tmp/memtest_$$.txt
   ```

3. Read it back:
   ```bash
   cat /tmp/memtest_$$.txt
   ```

4. Clean up:
   ```bash
   rm -f /tmp/memtest_$$.txt
   ```
