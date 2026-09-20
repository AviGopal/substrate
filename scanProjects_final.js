const fs = require('fs');

const projectFiles = fs.readFileSync('/workspace/git/super-repo/project_files.txt', 'utf8').trim().split('\n');

const reportItems = [];

for (const filePath of projectFiles) {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const projectName = filePath.split('/').pop().replace('.md', '');

        let openTasks = 0;
        let closedTasks = 0;

        const lines = content.split('\n');
        for (const line of lines) {
            if (line.match(/^- \[ \] .*/)) {
                openTasks++;
            } else if (line.match(/^- \[x\] .*/)) {
                closedTasks++;
            }
        }

        reportItems.push({
            project: projectName,
            tasks: {
                open: openTasks,
                closed: closedTasks,
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
