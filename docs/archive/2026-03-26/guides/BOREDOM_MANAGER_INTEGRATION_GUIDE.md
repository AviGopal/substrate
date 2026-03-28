# BoredomManager Integration Guide for Abort Signal

## Quick Integration Pattern

```typescript
import { executeActivityInline } from "../tool/activity"

class BoredomManager {
  private currentExecution: {
    controller: AbortController
    activityId: string
  } | null = null

  async executeAutonomously(templateId: string, variables: Record<string, unknown>) {
    // Create abort controller for this execution
    const controller = new AbortController()
    
    // Store reference for cancellation
    this.currentExecution = {
      controller,
      activityId: "pending"  // Will be updated after execution starts
    }
    
    try {
      // Execute activity with abort signal
      const result = await executeActivityInline(
        templateId,
        variables,
        this.sessionID,
        "Autonomous improvement during idle time",
        this.messageID,
        controller.signal  // <-- NEW: Pass abort signal
      )
      
      // Update with actual activity ID
      if (this.currentExecution) {
        this.currentExecution.activityId = result.activityId
      }
      
      // Check if cancelled
      if (result.cancelled) {
        log.info("Activity execution was cancelled", {
          activityId: result.activityId,
          templateId
        })
        return { cancelled: true, activityId: result.activityId }
      }
      
      // Check if successful
      if (result.success) {
        log.info("Activity execution completed successfully", {
          activityId: result.activityId,
          impulseCount: Object.keys(result.impulses).length
        })
        return { success: true, activityId: result.activityId }
      }
      
      // Failed but not cancelled
      log.warn("Activity execution failed", {
        activityId: result.activityId
      })
      return { failed: true, activityId: result.activityId }
      
    } catch (error) {
      log.error("Activity execution threw error", { error })
      throw error
    } finally {
      // Clean up execution reference
      this.currentExecution = null
    }
  }
  
  /**
   * Cancel current autonomous execution when user becomes active
   */
  onUserActivity() {
    if (this.currentExecution) {
      log.info("User activity detected, aborting autonomous execution", {
        activityId: this.currentExecution.activityId
      })
      
      // Abort the execution
      this.currentExecution.controller.abort()
      
      // Note: Don't set to null here - let finally block clean up
    }
  }
}
```

## Key Points

1. **Create AbortController per execution**: Don't reuse controllers
2. **Store reference**: Keep controller accessible for cancellation
3. **Check `cancelled` field**: Distinguish between failure and cancellation
4. **Clean up**: Set `currentExecution = null` in finally block
5. **Don't throw on abort**: `executeActivityInline()` returns gracefully

## Event Listener Pattern

```typescript
class BoredomManager {
  private currentExecution: AbortController | null = null
  
  constructor() {
    // Listen for user activity
    this.setupActivityListeners()
  }
  
  private setupActivityListeners() {
    // Listen for input events that indicate user is active
    process.stdin.on('data', () => this.onUserActivity())
    
    // Or use your existing idle detection mechanism
    IdleDetector.on('active', () => this.onUserActivity())
  }
  
  private onUserActivity() {
    if (this.currentExecution) {
      this.currentExecution.abort()
      this.currentExecution = null
    }
  }
  
  async startAutonomousExecution() {
    const controller = new AbortController()
    this.currentExecution = controller
    
    const result = await executeActivityInline(
      "improve-template",
      {},
      this.sessionID,
      "Autonomous improvement",
      this.messageID,
      controller.signal
    )
    
    if (result.cancelled) {
      console.log("Execution cancelled by user activity")
    }
    
    this.currentExecution = null
  }
}
```

## Testing the Integration

```typescript
// Test 1: Normal execution (no abort)
const controller1 = new AbortController()
const result1 = await executeActivityInline(
  "test-template",
  {},
  sessionID,
  "Test",
  messageID,
  controller1.signal
)
console.assert(!result1.cancelled, "Should complete normally")

// Test 2: Abort before execution
const controller2 = new AbortController()
controller2.abort()  // Abort immediately
const result2 = await executeActivityInline(
  "test-template",
  {},
  sessionID,
  "Test",
  messageID,
  controller2.signal
)
console.assert(result2.cancelled, "Should be cancelled")
console.assert(!result2.success, "Should not be successful")

// Test 3: Abort during execution (requires async setup)
const controller3 = new AbortController()
const executionPromise = executeActivityInline(
  "long-template",
  {},
  sessionID,
  "Test",
  messageID,
  controller3.signal
)

// Abort after 100ms
setTimeout(() => controller3.abort(), 100)

const result3 = await executionPromise
console.assert(result3.cancelled, "Should be cancelled")
```

## Backward Compatibility

Existing code without abort signal continues to work:

```typescript
// Old code (still works)
const result = await executeActivityInline(
  "template-id",
  variables,
  sessionID,
  reason,
  messageID
)

// New code (with abort support)
const controller = new AbortController()
const result = await executeActivityInline(
  "template-id",
  variables,
  sessionID,
  reason,
  messageID,
  controller.signal  // Optional parameter
)
```
