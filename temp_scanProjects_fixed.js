const fs = require('fs');

const projectFiles = ["/workspace/git/super-repo/Substrate/Projects/MyNewProject.md",
"/workspace/git/super-repo/Substrate/Projects/MyNewProjectWithUndispatchedTodos.md",
"/workspace/git/super-repo/Substrate/Projects/MyTestProject.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectForTesting.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithAnUndispatchedTodo.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithNewTodos.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithNewTodos.md.bak",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithNewUndispatchedTodo.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithOpenTodo.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithOpenTodos.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithUndispatchedTodo.md",
"/workspace/git/super-repo/Substrate/Projects/NewProjectWithUndispatchedTodos.md",
"/workspace/git/super-repo/Substrate/Projects/NewTestProjectWithOpenTodos.md.tmp",
"/workspace/git/super-repo/Substrate/Projects/TemporaryNewProject.md.bak",
"/workspace/git/super-repo/Substrate/Projects/TestProjectWithOpenTodos.md.tmp",
"/workspace/git/super-repo/Substrate/Projects/dummy_test_project.md",
"/workspace/git/super-repo/Substrate/Projects/my_dummy_project.md",
"/workspace/git/super-repo/Substrate/Projects/my_new_project.md",
"/workspace/git/super-repo/Substrate/Projects/my_project_with_todo.md",
"/workspace/git/super-repo/Substrate/Projects/my_test_project_new.md",
"/workspace/git/super-repo/Substrate/Projects/new_undispatched_todo_project.md",
"/workspace/git/super-repo/Substrate/Projects/temp_new_undispatched_project.md",
"/workspace/git/super-repo/Substrate/Projects/temp_project_with_todos.md",
"/workspace/git/super-repo/Substrate/Projects/temp_undispatched_todo.md",
"/workspace/git/super-repo/Substrate/Projects/test_basename.md",
"/workspace/git/super-repo/Substrate/Projects/test_dispatch.md",
"/workspace/git/super-repo/Substrate/Projects/test_project_with_open_todos.md",
"/workspace/git/super-repo/Substrate/Projects/test_project_with_todos.md",
"/workspace/git/super-repo/Substrate/Projects/test_single_dispatch.md",
"/workspace/git/super-repo/Substrate/Projects/test_tasks.md",
"/workspace/git/super-repo/Substrate/Projects/test_undispatched_todo.md",
];

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
