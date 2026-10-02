"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function countTasks(lines) {
    let openTasks = 0;
    let closedTasks = 0;
    let dispatchedTasks = 0;
    for (const line of lines) {
        const isDispatched = line.includes("[DISPATCHED]");
        const isClosedCheckbox = line.includes("- [x]");
        const isOpenCheckbox = line.includes("- [ ]");
        const isTodoKeyword = line.startsWith("TODO:");
        if (isDispatched) {
            dispatchedTasks++;
            closedTasks++;
        }
        else if (isClosedCheckbox) {
            closedTasks++;
        }
        else if (isOpenCheckbox || isTodoKeyword) {
            openTasks++;
        }
    }
    return { openTasks, closedTasks, dispatchedTasks };
}
async function main(executeGoals) {
    console.log("executeGoals:", executeGoals);
    console.log("Current script directory:", import.meta.dir);
    const projectReports = [];
    const projectsDirPath = (0, node_path_1.join)(import.meta.dir, "..", "..", "Substrate", "Projects");
    console.log("Projects directory path:", projectsDirPath);
    const projectFiles = (0, node_fs_1.readdirSync)(projectsDirPath).filter(file => file.endsWith(".md"));
    for (const file of projectFiles) {
        const filePath = (0, node_path_1.join)(projectsDirPath, file);
        const fileContent = (0, node_fs_1.readFileSync)(filePath, "utf-8");
        let projectName = "Untitled Project";
        const lines = fileContent.split("\n");
        let updatedLines = [...lines];
        // Extract project name from the first heading
        const titleLine = lines.find(line => line.startsWith("# "));
        if (titleLine) {
            projectName = titleLine.substring(2).replace(/\\n/g, "\n").split("\n")[0].trim();
        }
        else {
            // If no H1 heading found, use the filename as the project name (without extension)
            projectName = file.replace(".md", "");
        }
        if (executeGoals) {
            for (let i = 0; i < updatedLines.length; i++) {
                let line = updatedLines[i];
                const isOpenCheckbox = line.includes("- [ ]");
                const isTodoKeyword = line.startsWith("TODO:");
                if (isOpenCheckbox || isTodoKeyword) {
                    const date = new Date();
                    const formattedDate = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                    if (isOpenCheckbox) {
                        updatedLines[i] = line.replace("- [ ]", `- [x] [DISPATCHED:${formattedDate}]`);
                    }
                    else if (isTodoKeyword) {
                        updatedLines[i] = `- [x] ${line.substring(5).trim()} [DISPATCHED:${formattedDate}]`;
                    }
                }
            }
            (0, node_fs_1.writeFileSync)(filePath, updatedLines.join("\n"));
        }
        // Recalculate tasks after potential modifications
        const { openTasks, closedTasks, dispatchedTasks } = countTasks(updatedLines);
        console.log("Dispatched tasks for", projectName, ":", dispatchedTasks);
        projectReports.push({
            project: projectName,
            tasks: {
                open: openTasks,
                closed: closedTasks,
                dispatched: dispatchedTasks,
            },
        });
    }
    const finalReport = {
        projectThreadScanReport: {
            execute: executeGoals,
            items: projectReports
        }
    };
    const outputPath = (0, node_path_1.join)(projectsDirPath, "projectThreadScanReport.json");
    console.log("Output path for report:", outputPath);
    (0, node_fs_1.writeFileSync)(outputPath, JSON.stringify(finalReport, null, 2));
    console.log(`Generated project thread scan report at: ${outputPath}`);
}
const executeGoalsArg = process.argv.includes("--execute");
main(executeGoalsArg);
//# sourceMappingURL=project-thread-scan-modified.js.map