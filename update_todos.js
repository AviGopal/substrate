import fs from 'fs/promises';
import path from 'path';

async function processProjects() {
    const projectsDirPath = '/workspace/git/super-repo/Substrate/Projects';
    const allFiles = await fs.readdir(projectsDirPath);
    const projectFiles = allFiles.filter(file => file.endsWith('.md')).map(file => path.join(projectsDirPath, file));

    const report = [];

    for (const filePath of projectFiles) {
        let content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n');
        let modifiedLines = [];
        let fileModified = false;

        let openTasksCount = 0;
        let closedTasksCount = 0;
        let dispatchedTasksCount = 0;
        let projectName = path.basename(filePath, '.md'); // Default project name from filename

        // Extract project name from H1 heading if available
        const titleLine = lines.find(line => line.startsWith('# '));
        if (titleLine) {
            projectName = titleLine.substring(2).trim();
        }

        for (const line of lines) {
            if (line.includes('[DISPATCHED]')) {
                dispatchedTasksCount++;
                modifiedLines.push(line);
            } else if ((line.startsWith('- [ ]') || line.startsWith('TODO:')) && !line.includes('[DISPATCHED]')) {
                // This is an open "To do" item, dispatch it
                const timestamp = Math.floor(Date.now() / 1000);
                const newTodoLine = `${line} => dispatched ${timestamp} [DISPATCHED]`;
                modifiedLines.push(newTodoLine);
                dispatchedTasksCount++;
                fileModified = true;
            } else if (line.startsWith('- [x]')) {
                closedTasksCount++;
                modifiedLines.push(line);
            } else {
                modifiedLines.push(line);
            }
        }

        if (fileModified) {
            await fs.writeFile(filePath, modifiedLines.join('\n'), 'utf8');
        }
        
        report.push({
            project: projectName,
            tasks: {
                open: openTasksCount, 
                closed: closedTasksCount,
                dispatched: dispatchedTasksCount,
            },
        });
    }

    const outputPath = path.join(projectsDirPath, "projectThreadScanReport.json");
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Generated project thread scan report at: ${outputPath}`);
    console.log(JSON.stringify(report, null, 2));
}

processProjects();
