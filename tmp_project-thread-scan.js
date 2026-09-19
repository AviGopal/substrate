"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
async function main(executeGoals) {
    console.log("Current script directory:", import.meta.dir);
    const projectReports = [];
    const projectsDirPath = "/workspace/git/super-repo/openspec/changes";
    console.log("Projects directory path:", projectsDirPath);
    const entries = (0, node_fs_1.readdirSync)(projectsDirPath);
    for (const entry of entries) {
        const entryPath = (0, node_path_1.join)(projectsDirPath, entry);
        const stat = (0, node_fs_1.statSync)(entryPath);
        if (stat.isDirectory()) {
            const projectFiles = (0, node_fs_1.readdirSync)(entryPath).filter(file => file.endsWith(".md"));
            for (const file of projectFiles) {
                const filePath = (0, node_path_1.join)(entryPath, file);
                const fileContent = (0, node_fs_1.readFileSync)(filePath, "utf-8");
                let projectName = "Untitled Project";
                const lines = fileContent.split("\n");
                // Extract project name from the first heading
                const titleLine = lines.find(line => line.startsWith("# "));
                if (titleLine) {
                    projectName = titleLine.substring(2).trim();
                }
                else {
                    // If no H1 heading found, use the filename as the project name (without extension)
                    projectName = file.replace(".md", "");
                }
                let openTasks = 0;
                let closedTasks = 0;
                let dispatchedTasks = 0;
                for (const line of lines) {
                    if (line.includes("[DISPATCHED]")) {
                        dispatchedTasks++;
                    }
                    else if (line.startsWith("TODO:")) {
                        openTasks++;
                        if (executeGoals) {
                            dispatchedTasks++;
                            openTasks--;
                        }
                    }
                    else if (line.includes("- [ ]")) { // Markdown checkbox
                        openTasks++;
                        if (executeGoals) {
                            dispatchedTasks++;
                            openTasks--;
                        }
                    }
                    else if (line.includes("- [x]")) {
                        closedTasks++;
                    }
                }
                projectReports.push({
                    project: projectName,
                    tasks: {
                        open: openTasks,
                        closed: closedTasks,
                        dispatched: dispatchedTasks,
                    },
                });
            }
        }
    }
    // The overall report structure should indicate execute: true if the flag was passed
    const finalReport = {
        projectThreadScanReport: {
            execute: executeGoals,
            items: projectReports
        }
    };
    const outputPath = "/workspace/git/super-repo/projectThreadScanReport.json";
    console.log("Output path for report:", outputPath);
    (0, node_fs_1.writeFileSync)(outputPath, JSON.stringify(finalReport, null, 2));
    console.log(`Generated project thread scan report at: ${outputPath}`);
}
// Check for an argument to decide whether to execute goals
const executeGoalsArg = process.argv.includes("--execute");
main(executeGoalsArg);
//# sourceMappingURL=tmp_project-thread-scan.js.map