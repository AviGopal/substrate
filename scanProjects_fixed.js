const fs = require('fs');

const projectFiles = [
    "/workspace/git/super-repo/Substrate/Projects/MyNewOpenTasksProject.md",
    "/workspace/git/super-repo/Substrate/Projects/test_project_with_open_todos_for_real.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithAnOpenTodo.md",
    "/workspace/git/super-repo/Substrate/Projects/test_open_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/temp_project_with_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithTrulyOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/test_project_for_dispatch.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithNewTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/TestOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewTestProject.md",
    "/workspace/git/super-repo/Substrate/Projects/MyProject.md",
    "/workspace/git/super-repo/Substrate/Projects/new_temp_project_with_open_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProject.md",
    "/workspace/git/super-repo/Substrate/Projects/my_temp_project_with_open_todo.md",
    "/workspace/git/super-repo/Substrate/Projects/new_project_with_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/AnotherNewProjectWithTrulyOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/TestProjectWithOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewFileWithOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/TemporaryProjectWithOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/MyTestProject.md",
    "/workspace/git/super-repo/Substrate/Projects/new_project_with_undispatched_todo.md",
    "/workspace/git/super-repo/Substrate/Projects/ProjectWithOpenTodo.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithOpenTodosNow.md",
    "/workspace/git/super-repo/Substrate/Projects/UnfinishedProject.md",
    "/workspace/git/super-repo/Substrate/Projects/MyProjectWithOpenTodo.md",
    "/workspace/git/super-repo/Substrate/Projects/temp_project.md",
    "/workspace/git/super-repo/Substrate/Projects/dummy_project.md",
    "/workspace/git/super-repo/Substrate/Projects/AnotherProject.md",
    "/workspace/git/super-repo/Substrate/Projects/TemporaryNewProject.md",
    "/workspace/git/super-repo/Substrate/Projects/new_open_todo.md",
    "/workspace/git/super-repo/Substrate/Projects/MyNewProject.md",
    "/workspace/git/super-repo/Substrate/Projects/my_new_project_with_open_todo.md",
    "/workspace/git/super-repo/Substrate/Projects/test_dispatch_project.md",
    "/workspace/git/super-repo/Substrate/Projects/test_open_todos_new.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithOpenTodoForTest.md",
    "/workspace/git/super-repo/Substrate/Projects/test_project_with_open_todo.md",
    "/workspace/git/super-repo/Substrate/Projects/NewProjectWithOpenTask.md",
    "/workspace/git/super-repo/Substrate/Projects/temp_project_with_open_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/my_project_with_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/test_project_with_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/TestWithOpenTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/ProjectWithNewTodos.md",
    "/workspace/git/super-repo/Substrate/Projects/TestProject.md",
    "/workspace/git/super-repo/Substrate/Projects/temporary_test_project_with_todos.md",
    "/workspace/git/super-repo/Substrate/Projects/NewTestProjectWithOpenTodos.md",
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
