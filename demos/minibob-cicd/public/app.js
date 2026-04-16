/**
 * Task Manager Application
 *
 * Frontend for GitHub Issues-backed task manager.
 * Demonstrates activity-driven development.
 */

class TaskManager {
    constructor() {
        this.api = new GitHubAPI();
        this.currentFilter = 'all';
        this.tasks = [];

        this.initElements();
        this.attachListeners();
        this.loadTasks();
        this.updateActivityStatus('Application initialized');
    }

    initElements() {
        this.newTaskInput = document.getElementById('newTaskInput');
        this.addTaskBtn = document.getElementById('addTaskBtn');
        this.filterSelect = document.getElementById('filterSelect');
        this.taskList = document.getElementById('taskList');
        this.totalTasks = document.getElementById('totalTasks');
        this.openTasks = document.getElementById('openTasks');
        this.completedTasks = document.getElementById('completedTasks');
        this.lastActivity = document.getElementById('lastActivity');
    }

    attachListeners() {
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        this.filterSelect.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.renderTasks();
        });
    }

    async loadTasks() {
        try {
            this.showLoading();
            this.tasks = await this.api.getTasks(this.currentFilter);
            this.renderTasks();
            this.updateActivityStatus('Tasks loaded from GitHub Issues');
        } catch (error) {
            this.showError('Failed to load tasks. Using offline cache.');
            console.error(error);
        }
    }

    async addTask() {
        const text = this.newTaskInput.value.trim();
        if (!text) return;

        try {
            this.updateActivityStatus('Creating task...');
            const task = await this.api.createTask(text);
            this.tasks.unshift(task);
            this.newTaskInput.value = '';
            this.renderTasks();
            this.updateActivityStatus(`Task created: "${text}"`);
        } catch (error) {
            this.showError('Failed to create task');
            console.error(error);
        }
    }

    async toggleTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        try {
            this.updateActivityStatus('Updating task...');
            const updated = await this.api.updateTask(taskId, !task.completed);
            const index = this.tasks.findIndex(t => t.id === taskId);
            this.tasks[index] = updated;
            this.renderTasks();
            this.updateActivityStatus(`Task ${updated.completed ? 'completed' : 'reopened'}`);
        } catch (error) {
            this.showError('Failed to update task');
            console.error(error);
        }
    }

    async deleteTask(taskId) {
        if (!confirm('Delete this task?')) return;

        try {
            this.updateActivityStatus('Deleting task...');
            await this.api.deleteTask(taskId);
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.renderTasks();
            this.updateActivityStatus('Task deleted');
        } catch (error) {
            this.showError('Failed to delete task');
            console.error(error);
        }
    }

    renderTasks() {
        const filtered = this.getFilteredTasks();

        if (filtered.length === 0) {
            this.taskList.innerHTML = `
                <div class="empty-state">
                    <h3>No tasks found</h3>
                    <p>Add a task to get started!</p>
                </div>
            `;
        } else {
            this.taskList.innerHTML = filtered.map(task => `
                <div class="task-item ${task.completed ? 'completed' : ''}">
                    <input
                        type="checkbox"
                        class="task-checkbox"
                        ${task.completed ? 'checked' : ''}
                        onchange="app.toggleTask(${task.id})"
                    />
                    <span class="task-text">${this.escapeHtml(task.text)}</span>
                    <button class="task-delete" onclick="app.deleteTask(${task.id})">
                        Delete
                    </button>
                </div>
            `).join('');
        }

        this.updateStats();
    }

    getFilteredTasks() {
        if (this.currentFilter === 'all') {
            return this.tasks;
        } else if (this.currentFilter === 'open') {
            return this.tasks.filter(t => !t.completed);
        } else {
            return this.tasks.filter(t => t.completed);
        }
    }

    updateStats() {
        const total = this.tasks.length;
        const open = this.tasks.filter(t => !t.completed).length;
        const completed = this.tasks.filter(t => t.completed).length;

        this.totalTasks.textContent = total;
        this.openTasks.textContent = open;
        this.completedTasks.textContent = completed;
    }

    showLoading() {
        this.taskList.innerHTML = '<div class="loading">Loading tasks...</div>';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        this.taskList.insertBefore(errorDiv, this.taskList.firstChild);

        setTimeout(() => errorDiv.remove(), 5000);
    }

    updateActivityStatus(message) {
        this.lastActivity.textContent = `${message} (${new Date().toLocaleTimeString()})`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const app = new TaskManager();
