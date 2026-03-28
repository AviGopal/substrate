#!/usr/bin/env node
const fs = require('fs');

const files = [
  '.metabob/activities/configure-vessel-for-environment.json',
  '.metabob/activities/update-vessel-opencode-binary.json',
  '.metabob/activities/update-vessel-cli.json'
];

files.forEach(file => {
  console.log(`Fixing ${file}...`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  
  // Add author field if missing
  if (!('author' in data)) {
    data.author = null;
  }
  
  // Fix tasks: rename task_steps to tasks if needed, add id field
  const tasks = data.task_steps || data.tasks || [];
  data.tasks = tasks.map(task => {
    // Add id field if missing (copy from task_id)
    if (!task.id && task.task_id) {
      task.id = task.task_id;
    }
    
    // Fix validation commands
    if (task.validation && task.validation.commands) {
      task.validation.commands = task.validation.commands.map(cmd => {
        if (typeof cmd === 'string') {
          return { name: cmd, command: cmd, required: false };
        }
        if (!cmd.name) cmd.name = cmd.command || 'unnamed';
        if (!('required' in cmd)) cmd.required = false;
        return cmd;
      });
    }
    
    return task;
  });
  
  // Remove old task_steps field
  delete data.task_steps;
  
  // Write back
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`✓ Fixed ${file}`);
});

console.log('All vessel activities fixed!');
