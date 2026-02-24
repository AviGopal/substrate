# Test Template: Simple Hello World

**Purpose**: Create a minimal activity template to test the improved validation that blocks Handlebars syntax.

**Template Name**: test-validation-hello-world

**Description**: Simple hello world template to verify Handlebars syntax validation works

**Category**: infrastructure

**Tasks**:
1. **say-hello**: Write "Hello World!" to a file

**Variables**:
- `greeting`: The greeting message (default: "Hello World!")
- `outputFile`: Where to write the greeting (default: "hello.txt")

**Expected Result**:
- Template created successfully
- No Handlebars syntax in prompts
- Validation passes
