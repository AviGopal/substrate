const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process'); 

const REPO_ROOT = "/workspace/git/super-repo";
const PROJECTS_DIR = path.join(REPO_ROOT, "Substrate", "Projects");

function generateProjectThreadScanReport(projectFiles, goalsToDispatch) {
    const reportItems = [];

    for (const filePath of projectFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        const projectName = path.basename(filePath, '.md');

        let openTasks = 0;
        let closedTasks = 0;
        let dispatchedTasks = 0;

        const lines = content.split('\n');
        for (const line of lines) {
            if (line.match(/^- \[ \] .*/)) {
                if (line.includes('[DISPATCHED]')) {
                    dispatchedTasks++;
                } else {
                    openTasks++;
                }
            } else if (line.match(/^- \[x\] .*/)) {
                closedTasks++;
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
    }

    const finalReport = {
        projectThreadScanReport: {
            execute: true,
            items: reportItems,
            goalsToDispatch: goalsToDispatch
        }
    };

    return JSON.stringify(finalReport, null, 2);
}

async function processProjects() {
    const projectFilesOutput = execSync(`find ${PROJECTS_DIR} -name "*.md"`).toString();
    const projectFiles = projectFilesOutput.split('\n').map(file => file.trim()).filter(file => file.length > 0);

    let goalsToDispatch = [];
    
    for (const filePath of projectFiles) {
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let fileModified = false;
        let newLines = [];

        for (const line of lines) {
            if (line.match(/^- \[ \] .*/)) {
                if (!line.includes('[DISPATCHED]')) {
                    const taskDescription = line.substring(line.indexOf('] ') + 2).trim();
                    const goalSummary = `Task from ${path.basename(filePath, '.md')}: ${taskDescription}`;
                    
                    goalsToDispatch.push({
                        category: "project-todo",
                        summary: goalSummary,
                        projectFile: path.basename(filePath)
                    });

                    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                    const dispatchedLine = line.replace(/^- \[ \] /, `- [ ] [DISPATCHED:${timestamp}] `);
                    newLines.push(dispatchedLine);
                    fileModified = true;
                } else {
                    newLines.push(line);
                }
            } else {
                newLines.push(line);
            }
        }

        if (fileModified) {
            const updatedContent = newLines.join('\n');
            fs.writeFileSync(filePath, updatedContent, 'utf8');
        }
    }

    const report = generateProjectThreadScanReport(projectFiles, goalsToDispatch);

    console.log(report);
}

processProjects();
