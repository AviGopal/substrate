const fs = require("fs");

const projectFiles = [
    "Substrate/Projects/MyNewProject.md",
    "Substrate/Projects/MyTestProject.md",
    "Substrate/Projects/NewProjectWithUndispatchedTodo.md",
    "Substrate/Projects/my_new_project.md",
];

const reportItems = [];

for (const filePath of projectFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const projectName = filePath.split("/").pop().replace(".md", "");

    let openTasks = 0;
    let closedTasks = 0;
    let dispatchedTasks = 0;

    const lines = content.split("\n");
    for (const line of lines) {
        if (line.match(/^- \[ \] .*/)) {
            if (!line.includes("[DISPATCHED]")) {
                openTasks++;
            } else {
                dispatchedTasks++;
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
        items: reportItems
    }
};

console.log(JSON.stringify(finalReport, null, 2));
