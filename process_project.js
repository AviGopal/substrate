// process_project.js
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
const now = Math.floor(Date.now() / 1000);

let content = fs.readFileSync(filePath, 'utf8');
let updatedContent = content;
const todoItems = [];

const lines = content.split('\n');
console.log(`Processing file: ${filePath}`);
console.log(`Initial content:\n${content}`);

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    console.log(`Checking line: ${line}`);
    const openTodoMatch = line.match(/^- \[ \] (.*)/);
    const dispatchedTodoMatch = line.match(/^- \[x\] (.*)/);

    if (openTodoMatch) {
        console.log(`  Found open todo: ${openTodoMatch[1]}`);
        const description = openTodoMatch[1].trim();
        const newDescription = description.replace(/\(Dispatched\)/g, '').trim();
        const newLine = `- [x] ${newDescription} (Dispatched)`;
        updatedContent = updatedContent.replace(line, newLine);
        todoItems.push({
            description: newDescription,
            status: 'dispatched',
            dispatchedTimestamp: now
        });
        console.log(`  Updated line to: ${newLine}`);
    } else if (dispatchedTodoMatch) {
        console.log(`  Found dispatched todo: ${dispatchedTodoMatch[1]}`);
        const description = dispatchedTodoMatch[1].trim();
        const newDescription = description.replace(/\(Dispatched\)/g, '').trim();
        todoItems.push({
            description: newDescription,
            status: 'dispatched',
            dispatchedTimestamp: 1 // Placeholder timestamp
        });
    }
}

// Write updated content back to file
fs.writeFileSync(filePath, updatedContent, 'utf8');

console.log(`Final content:\n${updatedContent}`);
console.log(`Todo items for report: ${JSON.stringify(todoItems)}`);

console.log(JSON.stringify({
    filePath: path.resolve(filePath),
    todoItems: todoItems
}));
