Fetch the public GitHub API endpoint `https://api.github.com/repos/oven-sh/bun` using an HTTP GET request. Parse the JSON response and write a file `BUN_REPO.md` at the workspace root containing:

- The repository full name
- The description
- The number of stars (`stargazers_count`)
- The number of open issues (`open_issues_count`)
- The primary language
- The date the repo was last pushed to (`pushed_at`)

Format the file as a simple markdown document with a `# Bun Repository` heading and the fields listed as bullet points. Do not include any other fields.
