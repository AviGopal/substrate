# MiniBob Activity Composition and Impulse Chaining Guide

This guide teaches developers how to compose activities together using MiniBob's impulse chaining system to build complex workflows.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Understanding Impulses](#understanding-impulses)
3. [Activity Template Structure](#activity-template-structure)
4. [Impulse Chaining Patterns](#impulse-chaining-patterns)
5. [Composition Examples](#composition-examples)
6. [Advanced Techniques](#advanced-techniques)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Core Concepts

### What is Activity Composition?

Activity composition in MiniBob allows you to chain multiple activities together where the output of one activity becomes the input for another. This is achieved through MiniBob's **impulse system** - a lazy-loaded context management system that enables activities to share data efficiently.

### Key Components

- **Activities**: Discrete units of work defined by templates
- **Impulses**: Data pointers that reference content (files, outputs, API responses, etc.)
- **Shapes**: Type descriptors that define what kind of data an impulse contains
- **Composition Engine**: Routes data flow between activities based on shape compatibility

## Understanding Impulses

### What are Impulses?

Impulses are MiniBob's core abstraction for managing context and data flow between activities. Think of them as "smart pointers" that:

- **Reference data without loading it immediately** (lazy loading)
- **Have token budgets** to control memory usage
- **Can be resolved by different resolvers** (local files, API calls, activity outputs)
- **Carry metadata** about their content shape and structure

### Impulse Structure

```typescript
interface Impulse {
  id: string                    // Unique identifier
  pointer: ImpulsePointer      // What the impulse references
  budget: number               // Token limit for content
  priority: "critical" | "high" | "medium" | "low"
  loaded: boolean              // Whether content is loaded
  content?: string             // Actual content (when loaded)
  metadata?: ImpulseMetadata   // Structured info about content
}
```