-- Update activity-create template with schema and improved prompts
-- This fixes the template to use createActivityTemplate tool

-- First, let's see the current template
SELECT * FROM activity_templates WHERE variant_id = "INFRASTRUCTURE-0013e379";

-- Update impulse_refs at template level (add schema and example)
UPDATE activity_templates
SET impulse_refs = [
  {
    id: "activity-template-schema",
    type: "schema",
    pointer: {
      type: "memo",
      content: "# Activity Template Proto Schema\n\nActivity templates follow this structure:\n\n```json\n{\n  \"name\": \"string - Human-readable template name\",\n  \"description\": \"string - What this template does\",\n  \"category\": \"string - feature|bugfix|refactor|test|infrastructure\",\n  \"task_steps\": [\n    {\n      \"id\": \"string - Unique step identifier\",\n      \"description\": \"string - What this step does\",\n      \"subagent\": \"string - Agent type (general, config, tool, etc)\",\n      \"prompt\": {\n        \"template\": \"string - Instruction template with {{variables}}\",\n        \"variables\": [\"array\", \"of\", \"variable\", \"names\"],\n        \"max_tokens\": 2000\n      },\n      \"impulse_refs\": [\"array\", \"of\", \"impulse\", \"ids\"],\n      \"validation\": {\n        \"type\": \"output_contains|file_exists|command_success\",\n        \"value\": \"string - What to check for\"\n      }\n    }\n  ],\n  \"variables\": {},\n  \"context_requirements\": []\n}\n```"
    },
    description: "Proto schema for activity templates",
    priority: "high",
    budget: 4000
  },
  {
    id: "example-simple-template",
    type: "example",
    pointer: {
      type: "memo",
      content: "Example template with 2 steps showing variable interpolation and validation"
    },
    description: "Example of simple activity template",
    priority: "medium",
    budget: 2500
  }
]
WHERE variant_id = "INFRASTRUCTURE-0013e379";

-- Update task 4 (create-template) with improved prompt
UPDATE activity_templates
SET task_steps[3].prompt.template = "Create the activity template JSON following the activity-template-schema impulse.\n\nYour template should have:\n1. name: {{template_name}}\n2. description: {{template_description}}\n3. category: {{template_category}}\n4. task_steps: Array of steps\n5. variables: Object defining inputs\n\nIMPORTANT - PERSISTENCE:\nAfter generating the JSON, call createActivityTemplate(templateObject) to persist it to the backend.\n\nExample:\nconst template = {id: 'my-template', name: '...', category: 'test', tasks: [...]}\nconst result = await createActivityTemplate(template)\nconsole.log('Created:', result.templateId)\n\nDO NOT write to file. Must call createActivityTemplate.",
task_steps[3].impulse_refs = ["activity-template-schema", "example-simple-template"],
task_steps[3].guidance = [
  "Follow the schema exactly",
  "Call createActivityTemplate to persist",
  "Include returned templateId in output"
]
WHERE variant_id = "INFRASTRUCTURE-0013e379";

-- Verify the update
SELECT variant_id, variant_name, impulse_refs, task_steps[3] AS task4 
FROM activity_templates 
WHERE variant_id = "INFRASTRUCTURE-0013e379";
