/**
 * GitHub Issues API Client
 *
 * Uses GitHub Issues as a backend for task storage.
 * This demonstrates integration with existing processes.
 */

class GitHubAPI {
    constructor() {
        // Get repo from URL or use default
        const urlParams = new URLSearchParams(window.location.search);
        this.repo = urlParams.get('repo') || 'MetabobProject/minibob-cicd-demo';
        this.baseUrl = `https://api.github.com/repos/${this.repo}`;

        // Use localStorage for offline support
        this.cacheKey = `tasks_${this.repo}`;
        this.lastSync = null;
    }

    /**
     * Fetch all tasks (GitHub Issues)
     */
    async getTasks(filter = 'all') {
        try {
            const state = filter === 'all' ? 'all' : (filter === 'completed' ? 'closed' : 'open');
            const response = await fetch(`${this.baseUrl}/issues?state=${state}&labels=task`, {
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const issues = await response.json();
            const tasks = issues.map(this.issueToTask);

            // Cache for offline support
            localStorage.setItem(this.cacheKey, JSON.stringify(tasks));
            this.lastSync = new Date();

            return tasks;
        } catch (error) {
            console.error('Error fetching tasks:', error);

            // Fallback to cache
            const cached = localStorage.getItem(this.cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }

            throw error;
        }
    }

    /**
     * Create a new task (GitHub Issue)
     */
    async createTask(title) {
        try {
            const response = await fetch(`${this.baseUrl}/issues`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    title,
                    labels: ['task'],
                    body: `Task created via Task Manager web app\n\nCreated: ${new Date().toISOString()}`
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const issue = await response.json();
            return this.issueToTask(issue);
        } catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }

    /**
     * Update task status (close/reopen issue)
     */
    async updateTask(taskId, completed) {
        try {
            const response = await fetch(`${this.baseUrl}/issues/${taskId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    state: completed ? 'closed' : 'open'
                })
            });

            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status}`);
            }

            const issue = await response.json();
            return this.issueToTask(issue);
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }

    /**
     * Delete task (close issue with deleted label)
     */
    async deleteTask(taskId) {
        try {
            // Add 'deleted' label and close
            await fetch(`${this.baseUrl}/issues/${taskId}`, {
                method: 'PATCH',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    state: 'closed',
                    labels: ['task', 'deleted']
                })
            });
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    }

    /**
     * Get request headers
     */
    getHeaders() {
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        // Add token if available (for authenticated requests)
        const token = localStorage.getItem('github_token');
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        return headers;
    }

    /**
     * Convert GitHub Issue to Task object
     */
    issueToTask(issue) {
        return {
            id: issue.number,
            text: issue.title,
            completed: issue.state === 'closed' && !issue.labels.some(l => l.name === 'deleted'),
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            url: issue.html_url
        };
    }

    /**
     * Set GitHub token for authenticated requests
     */
    setToken(token) {
        localStorage.setItem('github_token', token);
    }
}

// Export for use in app.js
window.GitHubAPI = GitHubAPI;
