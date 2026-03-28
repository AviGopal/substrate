# Impulse Learning System: Pattern Learning Algorithm

**Date**: 2026-02-25  
**Purpose**: Complete algorithm specification for pattern extraction, matching, and impulse replay

---

## Executive Summary

This document provides the complete algorithmic specification for the impulse learning system's pattern learning engine. The engine learns user intent patterns and maps them to impulse creation strategies, enabling 60-80% skip rate for memory agent LLM calls.

**Core Algorithm Components**:
1. **Pattern Extraction**: Normalize user messages and extract variable placeholders
2. **Pattern Matching**: Similarity scoring to match new messages to learned patterns
3. **Impulse Replay**: Reconstruct impulses from pattern templates without LLM
4. **Pattern Storage**: Efficient database schema for pattern retrieval and metrics

---

## Part 1: Pattern Extraction Algorithm

### 1.1 Goal

Convert raw user messages into reusable pattern templates with variable placeholders.

**Example Transformations**:
```
"Fix bug in auth.ts" → Pattern: "fix_bug_in_{file0}"
"Add login feature to user.py" → Pattern: "add_{identifier0}_feature_to_{file0}"
"Refactor getUserById" → Pattern: "refactor_{identifier0}"
```

### 1.2 Data Structure: UserPattern

```typescript
interface UserPattern {
  // Pattern template with variable placeholders
  template: string                   // "Fix bug in {file0}"
  variables: PatternVariable[]       // Array of detected variables
  
  // Normalized representation for matching
  normalized: string                 // "fix_bug_in_X" (generic placeholder)
  intentType: string                 // "code_fix", "feature_request", etc.
  
  // Learned impulse mappings (captured from observations)
  impulseMapping: ImpulseMapping[]
  
  // Pattern strength metrics
  metrics: {
    observationCount: number         // Times seen
    successCount: number             // Times succeeded
    failureCount: number             // Times failed
    successRate: number              // successCount / observationCount
    avgResponseTime: number          // Average time to success (ms)
    lastUsed: number                 // Timestamp of last use
  }
  
  // Metadata
  patternId: string                  // Unique ID
  firstObserved: number              // Timestamp first seen
  lastUpdated: number                // Timestamp last updated
}

interface PatternVariable {
  name: string                       // "file0", "identifier1"
  type: "file" | "identifier" | "value" | "command"
  position: number                   // Character position in original message
  originalValue: string              // Original extracted value
  
  // Constraints (learned from observations)
  constraints?: {
    mustExist?: boolean              // File must exist
    expectedExtensions?: string[]    // [".ts", ".js"] for file variables
    expectedPattern?: string         // Regex pattern variable should match
  }
}

interface ImpulseMapping {
  // Impulse template
  type: "file" | "bashOutput" | "memo" | "metabobIssue" | "activityOutput"
  
  // Variable binding
  relativeToVariable?: string        // "file0" - which variable determines path
  pathTransform?: PathTransform      // How to transform variable to path
  
  // Impulse properties
  priority: "high" | "medium" | "low"
  budget: number                     // Token budget
  
  // Additional properties per type
  properties: Record<string, any>    // Type-specific properties
}

type PathTransform = 
  | "identity"                       // Use variable as-is
  | "toTestFile"                     // src/auth.ts → tests/auth.test.ts
  | "toDirectory"                    // src/auth.ts → src/
  | "toRelated"                      // Look for related files
  | { custom: string }               // Custom transformation expression
```

### 1.3 Pattern Extraction Algorithm

```typescript
/**
 * Extract pattern template from user message
 * Returns UserPattern with template, variables, and normalized form
 */
export function extractPattern(
  userMessage: string,
  intentType?: string
): UserPattern {
  
  // Step 1: Clean and normalize message
  const cleaned = cleanMessage(userMessage)
  
  // Step 2: Detect and extract variables
  const variables: PatternVariable[] = []
  let template = cleaned
  let workingText = cleaned
  
  // Variable detection order (most specific to least specific)
  
  // 2a. Detect file paths (with extensions)
  const fileMatches = detectFiles(workingText)
  for (const match of fileMatches) {
    const varName = `file${variables.length}`
    const variable: PatternVariable = {
      name: varName,
      type: "file",
      position: match.position,
      originalValue: match.value,
      constraints: {
        expectedExtensions: [getExtension(match.value)]
      }
    }
    variables.push(variable)
    
    // Replace in template with placeholder
    template = template.replace(match.value, `{${varName}}`)
    workingText = workingText.replace(match.value, `__FILE${variables.length}__`)
  }
  
  // 2b. Detect code identifiers (CamelCase, snake_case)
  const identifierMatches = detectIdentifiers(workingText)
  for (const match of identifierMatches) {
    const varName = `identifier${variables.length}`
    const variable: PatternVariable = {
      name: varName,
      type: "identifier",
      position: match.position,
      originalValue: match.value,
    }
    variables.push(variable)
    
    template = template.replace(match.value, `{${varName}}`)
    workingText = workingText.replace(match.value, `__ID${variables.length}__`)
  }
  
  // 2c. Detect commands (bash-like commands)
  const commandMatches = detectCommands(workingText)
  for (const match of commandMatches) {
    const varName = `command${variables.length}`
    const variable: PatternVariable = {
      name: varName,
      type: "command",
      position: match.position,
      originalValue: match.value,
    }
    variables.push(variable)
    
    template = template.replace(match.value, `{${varName}}`)
    workingText = workingText.replace(match.value, `__CMD${variables.length}__`)
  }
  
  // 2d. Detect quoted values
  const valueMatches = detectQuotedValues(workingText)
  for (const match of valueMatches) {
    const varName = `value${variables.length}`
    const variable: PatternVariable = {
      name: varName,
      type: "value",
      position: match.position,
      originalValue: match.value,
    }
    variables.push(variable)
    
    template = template.replace(match.value, `{${varName}}`)
    workingText = workingText.replace(match.value, `__VAL${variables.length}__`)
  }
  
  // Step 3: Create normalized pattern (generic placeholders)
  const normalized = createNormalizedPattern(template)
  
  // Step 4: Infer intent type if not provided
  const inferredIntent = intentType || inferIntentType(template, variables)
  
  return {
    template,
    variables,
    normalized,
    intentType: inferredIntent,
    impulseMapping: [], // Populated during learning
    metrics: {
      observationCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgResponseTime: 0,
      lastUsed: 0,
    },
    patternId: generatePatternId(normalized, inferredIntent),
    firstObserved: Date.now(),
    lastUpdated: Date.now(),
  }
}

/**
 * Clean and normalize user message
 */
function cleanMessage(message: string): string {
  // Lowercase
  let cleaned = message.toLowerCase()
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.!?]+$/, '')
  
  return cleaned
}

/**
 * Detect file paths in text
 */
function detectFiles(text: string): Array<{ value: string; position: number }> {
  const matches: Array<{ value: string; position: number }> = []
  
  // Regex for file paths (relative or absolute)
  // Matches: src/auth.ts, ./lib/utils.js, /home/user/file.py
  const fileRegex = /\b(?:\.?\.?\/)?[\w\-]+(?:\/[\w\-]+)*\.[\w]+\b/g
  
  let match: RegExpExecArray | null
  while ((match = fileRegex.exec(text)) !== null) {
    matches.push({
      value: match[0],
      position: match.index,
    })
  }
  
  return matches
}

/**
 * Detect code identifiers (functions, classes, variables)
 */
function detectIdentifiers(text: string): Array<{ value: string; position: number }> {
  const matches: Array<{ value: string; position: number }> = []
  
  // Regex for code identifiers
  // CamelCase: getUserById, UserService
  // snake_case: get_user_by_id, user_service
  // SCREAMING_SNAKE_CASE: MAX_RETRIES
  const identifierRegex = /\b(?:[A-Z][a-zA-Z0-9]*|[a-z_][a-zA-Z0-9_]*)\b/g
  
  let match: RegExpExecArray | null
  while ((match = identifierRegex.exec(text)) !== null) {
    // Filter out common English words
    if (!isCommonWord(match[0])) {
      matches.push({
        value: match[0],
        position: match.index,
      })
    }
  }
  
  return matches
}

/**
 * Detect bash commands
 */
function detectCommands(text: string): Array<{ value: string; position: number }> {
  const matches: Array<{ value: string; position: number }> = []
  
  // Look for common command patterns
  const commandKeywords = ['run', 'execute', 'npm', 'git', 'docker', 'pytest']
  
  for (const keyword of commandKeywords) {
    const regex = new RegExp(`\\b${keyword}\\s+[\\w\\-\\.]+\\b`, 'g')
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        value: match[0],
        position: match.index,
      })
    }
  }
  
  return matches
}

/**
 * Detect quoted values
 */
function detectQuotedValues(text: string): Array<{ value: string; position: number }> {
  const matches: Array<{ value: string; position: number }> = []
  
  // Match single or double quoted strings
  const quotedRegex = /["']([^"']+)["']/g
  
  let match: RegExpExecArray | null
  while ((match = quotedRegex.exec(text)) !== null) {
    matches.push({
      value: match[1], // Extract content without quotes
      position: match.index,
    })
  }
  
  return matches
}

/**
 * Create normalized pattern with generic placeholders
 */
function createNormalizedPattern(template: string): string {
  // Replace all {varName} with generic X placeholder
  let normalized = template.replace(/\{[a-zA-Z0-9_]+\}/g, 'X')
  
  // Replace whitespace with underscores
  normalized = normalized.replace(/\s+/g, '_')
  
  // Remove any remaining special characters
  normalized = normalized.replace(/[^a-zA-Z0-9_X]/g, '')
  
  return normalized
}

/**
 * Infer intent type from pattern structure
 */
function inferIntentType(template: string, variables: PatternVariable[]): string {
  const lowerTemplate = template.toLowerCase()
  
  // Intent detection rules
  if (lowerTemplate.includes('fix') || lowerTemplate.includes('bug')) {
    return 'code_fix'
  }
  if (lowerTemplate.includes('add') || lowerTemplate.includes('create')) {
    return 'feature_request'
  }
  if (lowerTemplate.includes('refactor') || lowerTemplate.includes('rewrite')) {
    return 'refactor'
  }
  if (lowerTemplate.includes('test')) {
    return 'test_request'
  }
  if (lowerTemplate.includes('explain') || lowerTemplate.includes('what')) {
    return 'explanation_request'
  }
  
  // Default based on variables
  if (variables.some(v => v.type === 'file')) {
    return 'file_modification'
  }
  
  return 'general'
}

/**
 * Check if word is common English word (should not be identifier)
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
    'fix', 'add', 'create', 'update', 'delete', 'get', 'set', 'run',
    'test', 'check', 'make', 'use', 'file', 'code', 'function', 'class'
  ])
  return commonWords.has(word.toLowerCase())
}

/**
 * Generate stable pattern ID
 */
function generatePatternId(normalized: string, intentType: string): string {
  // Use hash of normalized pattern + intent type
  const hash = simpleHash(`${normalized}:${intentType}`)
  return `pattern_${hash}`
}

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

function getExtension(filePath: string): string {
  const parts = filePath.split('.')
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : ''
}
```

### 1.4 Pattern Extraction Examples

**Example 1: Simple File Fix**
```typescript
Input: "Fix bug in src/auth.ts"

Output: {
  template: "fix bug in {file0}",
  variables: [
    {
      name: "file0",
      type: "file",
      position: 11,
      originalValue: "src/auth.ts",
      constraints: { expectedExtensions: [".ts"] }
    }
  ],
  normalized: "fix_bug_in_X",
  intentType: "code_fix",
  patternId: "pattern_1a2b3c",
  // ... other fields
}
```

**Example 2: Feature Request with Multiple Variables**
```typescript
Input: "Add login function to user.py"

Output: {
  template: "add {identifier0} {identifier1} to {file0}",
  variables: [
    { name: "identifier0", type: "identifier", position: 4, originalValue: "login" },
    { name: "identifier1", type: "identifier", position: 10, originalValue: "function" },
    { name: "file0", type: "file", position: 23, originalValue: "user.py" }
  ],
  normalized: "add_X_X_to_X",
  intentType: "feature_request",
  patternId: "pattern_4d5e6f",
}
```

**Example 3: Refactoring Request**
```typescript
Input: "Refactor getUserById method"

Output: {
  template: "refactor {identifier0} {identifier1}",
  variables: [
    { name: "identifier0", type: "identifier", position: 9, originalValue: "getUserById" },
    { name: "identifier1", type: "identifier", position: 21, originalValue: "method" }
  ],
  normalized: "refactor_X_X",
  intentType: "refactor",
  patternId: "pattern_7g8h9i",
}
```

---

## Part 2: Pattern Matching Algorithm

### 2.1 Goal

Match new user messages against learned patterns with confidence scoring.

### 2.2 Data Structure: PatternMatch

```typescript
interface PatternMatch {
  // Matched pattern
  pattern: UserPattern
  
  // Match confidence (0-1)
  confidence: number
  
  // Variable bindings from current message
  variableBindings: Record<string, string>  // { "file0": "src/auth.ts", ... }
  
  // Match metadata
  matchDetails: {
    normalizedSimilarity: number     // Similarity of normalized patterns
    variableCompatibility: number    // How well variables match constraints
    intentAgreement: number          // Do intents match?
    structuralSimilarity: number     // Template structure similarity
  }
}
```

### 2.3 Pattern Matching Algorithm

```typescript
/**
 * Match user message against learned patterns
 * Returns best matching pattern with confidence score
 */
export function matchPattern(
  userMessage: string,
  learnedPatterns: UserPattern[],
  options: {
    minConfidence?: number           // Minimum confidence threshold (default: 0.75)
    intentType?: string              // Filter by intent type
    topK?: number                    // Return top K matches (default: 1)
  } = {}
): PatternMatch | null {
  
  const minConfidence = options.minConfidence || 0.75
  const topK = options.topK || 1
  
  // Step 1: Extract pattern from new message
  const newPattern = extractPattern(userMessage, options.intentType)
  
  // Step 2: Filter candidates by intent type (if specified)
  let candidates = learnedPatterns
  if (options.intentType) {
    candidates = candidates.filter(p => p.intentType === options.intentType)
  }
  
  // Step 3: Compute match scores for all candidates
  const matches: PatternMatch[] = []
  
  for (const candidate of candidates) {
    const matchDetails = computeMatchScore(newPattern, candidate)
    
    // Overall confidence is weighted average of components
    const confidence = (
      matchDetails.normalizedSimilarity * 0.4 +
      matchDetails.variableCompatibility * 0.3 +
      matchDetails.intentAgreement * 0.2 +
      matchDetails.structuralSimilarity * 0.1
    )
    
    // Only keep matches above threshold
    if (confidence >= minConfidence) {
      // Extract variable bindings
      const bindings = extractVariableBindings(newPattern, candidate)
      
      matches.push({
        pattern: candidate,
        confidence,
        variableBindings: bindings,
        matchDetails,
      })
    }
  }
  
  // Step 4: Sort by confidence (descending)
  matches.sort((a, b) => b.confidence - a.confidence)
  
  // Return top match (or null if no matches)
  return matches.length > 0 ? matches[0] : null
}

/**
 * Compute match score between two patterns
 */
function computeMatchScore(
  newPattern: UserPattern,
  candidatePattern: UserPattern
): PatternMatch['matchDetails'] {
  
  // 1. Normalized similarity (most important)
  const normalizedSimilarity = computeStringSimilarity(
    newPattern.normalized,
    candidatePattern.normalized
  )
  
  // 2. Variable compatibility
  const variableCompatibility = computeVariableCompatibility(
    newPattern.variables,
    candidatePattern.variables
  )
  
  // 3. Intent agreement
  const intentAgreement = newPattern.intentType === candidatePattern.intentType ? 1.0 : 0.5
  
  // 4. Structural similarity (template length, word order)
  const structuralSimilarity = computeStructuralSimilarity(
    newPattern.template,
    candidatePattern.template
  )
  
  return {
    normalizedSimilarity,
    variableCompatibility,
    intentAgreement,
    structuralSimilarity,
  }
}

/**
 * Compute string similarity using Levenshtein distance
 */
function computeStringSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2)
  const maxLength = Math.max(str1.length, str2.length)
  
  // Normalize to 0-1 range (1 = identical, 0 = completely different)
  return 1 - (distance / maxLength)
}

/**
 * Levenshtein distance (edit distance) between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  
  // Create 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1).fill(null).map(() => 
    Array(len2 + 1).fill(0)
  )
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) dp[i][0] = i
  for (let j = 0; j <= len2; j++) dp[0][j] = j
  
  // Fill the DP table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] // Characters match, no operation needed
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,      // Deletion
          dp[i][j - 1] + 1,      // Insertion
          dp[i - 1][j - 1] + 1   // Substitution
        )
      }
    }
  }
  
  return dp[len1][len2]
}

/**
 * Compute variable compatibility score
 */
function computeVariableCompatibility(
  newVars: PatternVariable[],
  candidateVars: PatternVariable[]
): number {
  // Variables must match in count and types
  if (newVars.length !== candidateVars.length) {
    return 0.5 // Partial credit if counts differ
  }
  
  let compatibilityScore = 0
  
  for (let i = 0; i < newVars.length; i++) {
    const newVar = newVars[i]
    const candidateVar = candidateVars[i]
    
    // Check type match
    if (newVar.type === candidateVar.type) {
      compatibilityScore += 1.0
      
      // Check constraints (if any)
      if (candidateVar.constraints) {
        if (checkConstraints(newVar, candidateVar.constraints)) {
          compatibilityScore += 0.5 // Bonus for constraint match
        }
      }
    } else {
      compatibilityScore += 0.3 // Partial credit for type mismatch
    }
  }
  
  // Normalize to 0-1 range
  return compatibilityScore / (newVars.length * 1.5)
}

/**
 * Check if variable satisfies constraints
 */
function checkConstraints(
  variable: PatternVariable,
  constraints: PatternVariable['constraints']
): boolean {
  if (!constraints) return true
  
  // Check file extension constraint
  if (constraints.expectedExtensions && variable.type === 'file') {
    const ext = getExtension(variable.originalValue)
    return constraints.expectedExtensions.includes(ext)
  }
  
  // Check pattern constraint
  if (constraints.expectedPattern) {
    const regex = new RegExp(constraints.expectedPattern)
    return regex.test(variable.originalValue)
  }
  
  return true
}

/**
 * Compute structural similarity (template word order)
 */
function computeStructuralSimilarity(template1: string, template2: string): number {
  const words1 = template1.split(/\s+/)
  const words2 = template2.split(/\s+/)
  
  // Use Jaccard similarity on word sets
  const set1 = new Set(words1.filter(w => !w.startsWith('{')))
  const set2 = new Set(words2.filter(w => !w.startsWith('{')))
  
  const intersection = new Set([...set1].filter(x => set2.has(x)))
  const union = new Set([...set1, ...set2])
  
  return intersection.size / union.size
}

/**
 * Extract variable bindings from matched pattern
 */
function extractVariableBindings(
  newPattern: UserPattern,
  matchedPattern: UserPattern
): Record<string, string> {
  const bindings: Record<string, string> = {}
  
  // Align variables by position
  for (let i = 0; i < newPattern.variables.length; i++) {
    const newVar = newPattern.variables[i]
    const matchedVar = matchedPattern.variables[i]
    
    if (matchedVar) {
      // Bind matched variable name to new value
      bindings[matchedVar.name] = newVar.originalValue
    }
  }
  
  return bindings
}
```

### 2.4 Pattern Matching Examples

**Example 1: Exact Match**
```typescript
Learned Pattern: {
  template: "fix bug in {file0}",
  normalized: "fix_bug_in_X",
  intentType: "code_fix",
  variables: [{ name: "file0", type: "file", ... }]
}

New Message: "Fix bug in auth.ts"

Match Result: {
  pattern: <learned pattern>,
  confidence: 0.95,
  variableBindings: { "file0": "auth.ts" },
  matchDetails: {
    normalizedSimilarity: 1.0,
    variableCompatibility: 1.0,
    intentAgreement: 1.0,
    structuralSimilarity: 0.9,
  }
}
```

**Example 2: Partial Match**
```typescript
Learned Pattern: {
  template: "add {identifier0} to {file0}",
  normalized: "add_X_to_X",
  intentType: "feature_request",
}

New Message: "Create login feature in user.py"

Match Result: {
  confidence: 0.72,  // Below threshold (0.75), rejected
  matchDetails: {
    normalizedSimilarity: 0.65,  // "create" vs "add"
    variableCompatibility: 0.9,
    intentAgreement: 1.0,
    structuralSimilarity: 0.6,
  }
}
```

---

## Part 3: Impulse Replay Algorithm

### 3.1 Goal

Reconstruct impulses from pattern template without LLM call.

### 3.2 Impulse Replay Algorithm

```typescript
/**
 * Replay impulses from matched pattern
 * Constructs impulses using variable bindings and learned mappings
 */
export async function replayImpulsesFromPattern(
  match: PatternMatch,
  sessionID: string,
  context: {
    recentFiles: string[]
    workingDirectory: string
  }
): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  
  const impulses: Record<string, ActivityTemplate.Impulse.Schema> = {}
  
  // For each learned impulse mapping
  for (let i = 0; i < match.pattern.impulseMapping.length; i++) {
    const mapping = match.pattern.impulseMapping[i]
    const impulseId = `replay_${i}`
    
    // Construct impulse pointer based on mapping type
    let pointer: ImpulsePointer
    
    switch (mapping.type) {
      case 'file':
        pointer = await constructFilePointer(mapping, match.variableBindings, context)
        break
      
      case 'bashOutput':
        pointer = await constructBashPointer(mapping, match.variableBindings)
        break
      
      case 'memo':
        pointer = await constructMemoPointer(mapping, match.variableBindings)
        break
      
      case 'metabobIssue':
        pointer = await constructMetabobPointer(mapping, match.variableBindings, context)
        break
      
      case 'activityOutput':
        pointer = await constructActivityPointer(mapping, match.variableBindings)
        break
      
      default:
        throw new Error(`Unknown impulse type: ${mapping.type}`)
    }
    
    // Create impulse with replay metadata
    impulses[impulseId] = {
      id: impulseId,
      type: mapping.type,
      pointer,
      priority: mapping.priority,
      budget: mapping.budget,
      loaded: false,
      metadata: {
        source: 'pattern-replay',
        patternId: match.pattern.patternId,
        confidence: match.confidence,
        replayedAt: Date.now(),
      }
    }
  }
  
  return impulses
}

/**
 * Construct file impulse pointer from mapping
 */
async function constructFilePointer(
  mapping: ImpulseMapping,
  bindings: Record<string, string>,
  context: { recentFiles: string[]; workingDirectory: string }
): Promise<ImpulsePointer.File> {
  
  // Get variable value
  const variableValue = mapping.relativeToVariable 
    ? bindings[mapping.relativeToVariable]
    : null
  
  if (!variableValue) {
    throw new Error(`Variable ${mapping.relativeToVariable} not found in bindings`)
  }
  
  // Apply path transformation
  let filePath = variableValue
  
  if (mapping.pathTransform) {
    filePath = await applyPathTransform(
      variableValue,
      mapping.pathTransform,
      context
    )
  }
  
  // Resolve to absolute path
  const absolutePath = resolveToAbsolutePath(filePath, context.workingDirectory)
  
  return {
    type: 'file',
    path: absolutePath,
  }
}

/**
 * Apply path transformation to variable value
 */
async function applyPathTransform(
  value: string,
  transform: PathTransform,
  context: { recentFiles: string[]; workingDirectory: string }
): Promise<string> {
  
  switch (transform) {
    case 'identity':
      return value
    
    case 'toTestFile':
      // src/auth.ts → tests/auth.test.ts
      return transformToTestFile(value)
    
    case 'toDirectory':
      // src/auth.ts → src/
      return transformToDirectory(value)
    
    case 'toRelated':
      // Look for related files in recent files
      return findRelatedFile(value, context.recentFiles)
    
    default:
      if (typeof transform === 'object' && transform.custom) {
        // Execute custom transformation expression
        return executeCustomTransform(value, transform.custom)
      }
      return value
  }
}

/**
 * Transform file path to test file path
 */
function transformToTestFile(filePath: string): string {
  // src/auth.ts → tests/auth.test.ts
  const parts = filePath.split('/')
  const fileName = parts[parts.length - 1]
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
  const ext = fileName.match(/\.[^.]+$/)?.[0] || ''
  
  return `tests/${nameWithoutExt}.test${ext}`
}

/**
 * Transform file path to directory
 */
function transformToDirectory(filePath: string): string {
  const parts = filePath.split('/')
  parts.pop() // Remove file name
  return parts.join('/') + '/'
}

/**
 * Find related file in recent files
 */
function findRelatedFile(filePath: string, recentFiles: string[]): string {
  const fileName = filePath.split('/').pop() || ''
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '')
  
  // Look for files with similar names
  for (const recentFile of recentFiles) {
    if (recentFile.includes(nameWithoutExt) && recentFile !== filePath) {
      return recentFile
    }
  }
  
  // Fallback to original
  return filePath
}

/**
 * Execute custom transformation expression
 */
function executeCustomTransform(value: string, expression: string): string {
  // Simple expression evaluator
  // Supports: {value}.replace("src", "tests")
  try {
    const fn = new Function('value', `return ${expression}`)
    return fn(value)
  } catch (error) {
    log.warn('custom transform failed', { expression, error })
    return value
  }
}

/**
 * Construct bash output pointer
 */
async function constructBashPointer(
  mapping: ImpulseMapping,
  bindings: Record<string, string>
): Promise<ImpulsePointer.BashOutput> {
  
  // Get command template from properties
  let command = mapping.properties.command as string
  
  // Replace variables in command
  for (const [varName, varValue] of Object.entries(bindings)) {
    command = command.replace(`{${varName}}`, varValue)
  }
  
  return {
    type: 'bashOutput',
    command,
    executed: false,
  }
}

/**
 * Construct memo pointer
 */
async function constructMemoPointer(
  mapping: ImpulseMapping,
  bindings: Record<string, string>
): Promise<ImpulsePointer.Memo> {
  
  // Get memo template from properties
  let content = mapping.properties.content as string
  
  // Replace variables in content
  for (const [varName, varValue] of Object.entries(bindings)) {
    content = content.replace(`{${varName}}`, varValue)
  }
  
  return {
    type: 'memo',
    content,
  }
}

/**
 * Construct Metabob issue pointer
 */
async function constructMetabobPointer(
  mapping: ImpulseMapping,
  bindings: Record<string, string>,
  context: { recentFiles: string[] }
): Promise<ImpulsePointer.MetabobIssue> {
  
  // Get file path from bindings
  const filePath = mapping.relativeToVariable
    ? bindings[mapping.relativeToVariable]
    : context.recentFiles[0] // Default to most recent file
  
  return {
    type: 'metabobIssue',
    filePath,
    severity: mapping.properties.severity || 'HIGH',
  }
}

/**
 * Construct activity output pointer
 */
async function constructActivityPointer(
  mapping: ImpulseMapping,
  bindings: Record<string, string>
): Promise<ImpulsePointer.ActivityOutput> {
  
  return {
    type: 'activityOutput',
    activityId: mapping.properties.activityId,
    taskId: mapping.properties.taskId,
  }
}

/**
 * Resolve relative path to absolute path
 */
function resolveToAbsolutePath(filePath: string, workingDirectory: string): string {
  if (filePath.startsWith('/')) {
    return filePath // Already absolute
  }
  
  // Resolve relative to working directory
  return `${workingDirectory}/${filePath}`.replace(/\/+/g, '/')
}
```

### 3.3 Impulse Replay Examples

**Example 1: File Impulse Replay**
```typescript
Pattern Mapping: {
  type: "file",
  relativeToVariable: "file0",
  pathTransform: "identity",
  priority: "high",
  budget: 2000,
}

Variable Bindings: { "file0": "src/auth.ts" }

Replayed Impulse: {
  id: "replay_0",
  type: "file",
  pointer: { type: "file", path: "/workspace/src/auth.ts" },
  priority: "high",
  budget: 2000,
  loaded: false,
  metadata: {
    source: "pattern-replay",
    patternId: "pattern_1a2b3c",
    confidence: 0.95,
  }
}
```

**Example 2: Bash Output Impulse Replay**
```typescript
Pattern Mapping: {
  type: "bashOutput",
  properties: { command: "npm test {file0}" },
  priority: "medium",
  budget: 1000,
}

Variable Bindings: { "file0": "auth.test.ts" }

Replayed Impulse: {
  id: "replay_1",
  type: "bashOutput",
  pointer: { 
    type: "bashOutput", 
    command: "npm test auth.test.ts",
    executed: false 
  },
  priority: "medium",
  budget: 1000,
  metadata: { ... }
}
```

---

## Part 4: Pattern Storage Schema

### 4.1 Database Tables

**Table 1: pattern_library**
```sql
CREATE TABLE pattern_library (
  -- Primary key
  id TEXT PRIMARY KEY,                    -- pattern_1a2b3c
  
  -- Pattern template
  template TEXT NOT NULL,                 -- "fix bug in {file0}"
  normalized TEXT NOT NULL,               -- "fix_bug_in_X"
  variables TEXT NOT NULL,                -- JSON array of PatternVariable
  intent_type TEXT NOT NULL,              -- "code_fix", "feature_request"
  
  -- Learned impulse mappings
  impulse_mapping TEXT NOT NULL,          -- JSON array of ImpulseMapping
  
  -- Pattern metrics
  observation_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0.0,
  avg_response_time_ms REAL DEFAULT 0.0,
  
  -- Timestamps
  first_observed INTEGER NOT NULL,        -- Unix timestamp (ms)
  last_used INTEGER NOT NULL,             -- Unix timestamp (ms)
  last_updated INTEGER NOT NULL,          -- Unix timestamp (ms)
  
  -- Metadata
  metadata TEXT,                          -- JSON object for additional data
  
  -- Indexes for fast lookup
  INDEX idx_normalized (normalized),
  INDEX idx_intent_type (intent_type),
  INDEX idx_success_rate (success_rate DESC),
  INDEX idx_last_used (last_used DESC),
  INDEX idx_observation_count (observation_count DESC)
);
```

**Table 2: pattern_matches** (tracking match history)
```sql
CREATE TABLE pattern_matches (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- Match information
  pattern_id TEXT NOT NULL,               -- FK to pattern_library
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  
  -- User message
  user_message TEXT NOT NULL,
  
  -- Match details
  confidence REAL NOT NULL,
  variable_bindings TEXT NOT NULL,        -- JSON object
  match_details TEXT NOT NULL,            -- JSON object with similarity scores
  
  -- Outcome
  skipped_llm BOOLEAN NOT NULL,           -- Was LLM skipped?
  task_succeeded BOOLEAN,                 -- Did task succeed?
  response_time_ms REAL,
  
  -- Timestamp
  matched_at INTEGER NOT NULL,
  
  -- Indexes
  INDEX idx_pattern_id (pattern_id),
  INDEX idx_session_id (session_id),
  INDEX idx_matched_at (matched_at DESC),
  FOREIGN KEY (pattern_id) REFERENCES pattern_library(id)
);
```

**Table 3: impulse_mapping_records** (raw learning data)
```sql
CREATE TABLE impulse_mapping_records (
  -- Primary key
  id TEXT PRIMARY KEY,
  
  -- User intent
  raw_text TEXT NOT NULL,
  normalized_pattern TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  intent_confidence REAL NOT NULL,
  
  -- Context
  recent_files TEXT NOT NULL,             -- JSON array
  session_id TEXT NOT NULL,
  turn_number INTEGER NOT NULL,
  captured_at INTEGER NOT NULL,
  
  -- Impulses created (JSON array)
  impulses TEXT NOT NULL,
  
  -- Outcome
  task_succeeded BOOLEAN NOT NULL,
  response_quality REAL NOT NULL,
  impulses_used_count INTEGER NOT NULL,
  time_to_success INTEGER NOT NULL,
  
  -- Metadata
  record_id TEXT NOT NULL,
  
  -- Indexes
  INDEX idx_normalized_pattern (normalized_pattern),
  INDEX idx_intent_type (intent_type),
  INDEX idx_session_id (session_id),
  INDEX idx_captured_at (captured_at DESC)
);
```

### 4.2 Query Patterns

**Query 1: Find Best Matching Patterns**
```sql
-- Find patterns similar to normalized pattern
SELECT 
  id,
  template,
  normalized,
  intent_type,
  success_rate,
  observation_count,
  impulse_mapping
FROM pattern_library
WHERE 
  normalized LIKE '%fix%bug%' 
  AND intent_type = 'code_fix'
  AND success_rate > 0.75
  AND observation_count > 3
ORDER BY 
  success_rate DESC,
  observation_count DESC
LIMIT 10;
```

**Query 2: Track Pattern Performance Over Time**
```sql
-- Pattern usage and success rate over last 30 days
SELECT 
  p.id,
  p.template,
  COUNT(m.id) as times_used,
  SUM(CASE WHEN m.task_succeeded THEN 1 ELSE 0 END) as successes,
  ROUND(100.0 * SUM(CASE WHEN m.task_succeeded THEN 1 ELSE 0 END) / COUNT(m.id), 2) as success_rate,
  ROUND(AVG(m.response_time_ms), 2) as avg_response_time
FROM pattern_library p
LEFT JOIN pattern_matches m ON m.pattern_id = p.id
WHERE m.matched_at > (strftime('%s', 'now') - 30 * 86400) * 1000
GROUP BY p.id
ORDER BY times_used DESC, success_rate DESC
LIMIT 20;
```

**Query 3: Identify Underperforming Patterns**
```sql
-- Patterns with low success rate (candidates for removal)
SELECT 
  id,
  template,
  normalized,
  observation_count,
  success_count,
  failure_count,
  success_rate
FROM pattern_library
WHERE 
  observation_count >= 5
  AND success_rate < 0.5
ORDER BY observation_count DESC, success_rate ASC;
```

**Query 4: Aggregate Learning Statistics**
```sql
-- Overall learning system stats
SELECT 
  COUNT(*) as total_patterns,
  SUM(CASE WHEN success_rate >= 0.75 THEN 1 ELSE 0 END) as reliable_patterns,
  ROUND(AVG(success_rate), 3) as avg_success_rate,
  SUM(observation_count) as total_observations,
  SUM(success_count) as total_successes,
  ROUND(100.0 * SUM(success_count) / SUM(observation_count), 2) as overall_success_rate
FROM pattern_library;
```

### 4.3 Indexing Strategy

**Primary Indexes** (created with table):
- `idx_normalized`: Fast lookup by normalized pattern (most frequent query)
- `idx_intent_type`: Filter by intent type
- `idx_success_rate`: Sort by pattern reliability
- `idx_last_used`: Find recently used patterns
- `idx_observation_count`: Find frequently observed patterns

**Composite Indexes** (for common queries):
```sql
-- For pattern matching queries
CREATE INDEX idx_normalized_intent_success 
ON pattern_library(normalized, intent_type, success_rate DESC);

-- For pattern usage tracking
CREATE INDEX idx_pattern_match_time 
ON pattern_matches(pattern_id, matched_at DESC);

-- For session analysis
CREATE INDEX idx_session_turn 
ON pattern_matches(session_id, turn_number);
```

---

## Part 5: Complete Example Walkthrough

### Scenario: Learning and Replaying Bug Fix Pattern

**Phase 1: Initial Capture (Learning)**

User Message: "Fix bug in src/auth.ts"

1. **Memory Agent Runs** (LLM call):
   - Intent Analysis: `{ type: "code_fix", confidence: 0.92 }`
   - Creates impulses: `[{ type: "file", path: "src/auth.ts" }]`
   - Task succeeds

2. **Pattern Extraction**:
   ```typescript
   {
     template: "fix bug in {file0}",
     normalized: "fix_bug_in_X",
     intentType: "code_fix",
     variables: [{ name: "file0", type: "file", originalValue: "src/auth.ts" }]
   }
   ```

3. **Capture Mapping Record**:
   ```typescript
   {
     userIntent: { rawText: "Fix bug in src/auth.ts", ... },
     impulses: [{ type: "file", pointer: { path: "src/auth.ts" }, used: true }],
     outcome: { taskSucceeded: true, impulsesUsedCount: 1 }
   }
   ```

4. **Learn Pattern** (insert into pattern_library):
   ```sql
   INSERT INTO pattern_library (
     id, template, normalized, intent_type, impulse_mapping, observation_count
   ) VALUES (
     'pattern_abc123',
     'fix bug in {file0}',
     'fix_bug_in_X',
     'code_fix',
     '[{"type":"file","relativeToVariable":"file0","pathTransform":"identity","priority":"high","budget":2000}]',
     1
   );
   ```

**Phase 2: Pattern Matching (Replay)**

User Message: "Fix bug in user.py"

1. **Pattern Matching**:
   ```typescript
   const match = matchPattern("Fix bug in user.py", learnedPatterns)
   
   // Result:
   {
     pattern: <pattern_abc123>,
     confidence: 0.95,
     variableBindings: { "file0": "user.py" },
     matchDetails: {
       normalizedSimilarity: 1.0,  // Exact match!
       variableCompatibility: 1.0,
       intentAgreement: 1.0,
       structuralSimilarity: 0.9,
     }
   }
   ```

2. **Skip Decision**:
   ```typescript
   // Confidence > 0.85 → SKIP LLM call
   shouldSkip = true
   ```

3. **Impulse Replay**:
   ```typescript
   const impulses = await replayImpulsesFromPattern(match, sessionID, context)
   
   // Result:
   {
     "replay_0": {
       id: "replay_0",
       type: "file",
       pointer: { type: "file", path: "/workspace/user.py" },
       priority: "high",
       budget: 2000,
       metadata: { source: "pattern-replay", confidence: 0.95 }
     }
   }
   ```

4. **Update Pattern Metrics**:
   ```sql
   UPDATE pattern_library
   SET 
     observation_count = observation_count + 1,
     success_count = success_count + 1,
     success_rate = success_count / observation_count,
     last_used = <timestamp>
   WHERE id = 'pattern_abc123';
   ```

**Outcome**:
- LLM call skipped ✅
- Correct impulse created ✅
- Time saved: ~1.5 seconds ✅
- Task succeeded ✅

---

## Summary

This document provides complete algorithmic specifications for:

1. ✅ **Pattern Extraction**: Normalize messages, detect variables, create templates
2. ✅ **Pattern Matching**: Similarity scoring with confidence thresholds
3. ✅ **Impulse Replay**: Reconstruct impulses from templates and variable bindings
4. ✅ **Pattern Storage**: Database schema with efficient indexing

**Key Algorithms**:
- Levenshtein distance for string similarity
- Variable detection with regex patterns
- Path transformation for file impulses
- Confidence scoring with weighted components

**Performance Targets**:
- Pattern extraction: <10ms per message
- Pattern matching: <50ms for 1000 patterns
- Impulse replay: <20ms per impulse
- Database queries: <5ms with proper indexes

**Next Steps**:
1. Implement pattern extraction and matching engines
2. Create pattern storage infrastructure
3. Integrate with memory agent skip decision logic
4. Validate on test dataset (target: >80% accuracy)
