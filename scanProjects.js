const fs = require('fs');
const path = require('path');

const projectsDir = '/workspace/git/super-repo/Substrate/Projects';

// Dynamically find all markdown files in the projects directory
const projectFiles = fs.readdirSync(projectsDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(projectsDir, file));

const reportItems = [];

for (const filePath of projectFiles) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const projectName = path.basename(filePath, '.md');

        let openTasks = 0;
        let closedTasks = 0;
        let dispatchedTasks = 0;

        const lines = content.split('\n');
        for (const line of lines) {
            if (line.match(/^- \[x\] \[DISPATCHED:.*?\] .*/)) { 
                // Matches lines like "- [x] [DISPATCHED:2026-09-16 19:28:42] This is a dispatched todo item."
                dispatchedTasks++;
            } else if (line.match(/^- \[x\] .*/)) {
                // Matches lines like "- [x] This is a closed todo item." but NOT dispatched ones
                closedTasks++;
            } else if (line.match(/^- \[ \] .*/)) {
                // Matches lines like "- [ ] This is an open todo item."
                openTasks++;
            }
        }

        reportItems.push({
            project: projectName,
            tasks: {
                open: openTasks,
                closed: closedTasks,
                dispatched: dispatchedTasks
            }
        });
    } else {
        console.warn(`File not found: ${filePath}`);
    }
}

const finalReport = {
    projectThreadScanReport: {
        execute: true,
        items: reportItems
    }
};

console.log(JSON.stringify(finalReport, null, 2));
