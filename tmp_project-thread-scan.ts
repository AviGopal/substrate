import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

interface ProjectReport {
  project: string;
  tasks: {
    open: number;
    closed: number;
    dispatched: number;
  };
}

async function main(executeGoals: boolean) {
  console.log("Current script directory:", import.meta.dir);
  const projectReports: ProjectReport[] = [];
  const projectsDirPath = "/workspace/git/super-repo/openspec/changes";
  console.log("Projects directory path:", projectsDirPath);

  const entries = readdirSync(projectsDirPath);

  for (const entry of entries) {
    const entryPath = join(projectsDirPath, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      const projectFiles = readdirSync(entryPath).filter(file => file.endsWith(".md"));

      for (const file of projectFiles) {
        const filePath = join(entryPath, file);
        const fileContent = readFileSync(filePath, "utf-8");

        let projectName = "Untitled Project";
        const lines = fileContent.split("\n");
        
        // Extract project name from the first heading
        const titleLine = lines.find(line => line.startsWith("# "));
        if (titleLine) {
          projectName = titleLine.substring(2).trim();
        } else {
            // If no H1 heading found, use the filename as the project name (without extension)
            projectName = file.replace(".md", "");
        }

        let openTasks = 0;
        let closedTasks = 0;
        let dispatchedTasks = 0;

        for (const line of lines) {
          if (line.includes("[DISPATCHED]")) {
            dispatchedTasks++;
          } else if (line.startsWith("TODO:")) {
            openTasks++;
            if (executeGoals) {
                dispatchedTasks++;
                openTasks--;
            }
          } else if (line.includes("- [ ]")) { // Markdown checkbox
            openTasks++;
            if (executeGoals) {
                dispatchedTasks++;
                openTasks--;
            }
          } else if (line.includes("- [x]")) {
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
  }

  const outputPath = "/workspace/git/super-repo/projectThreadScanReport.json";
  console.log("Output path for report:", outputPath);
  writeFileSync(outputPath, JSON.stringify(finalReport, null, 2));

  console.log(`Generated project thread scan report at: ${outputPath}`);
}

// Check for an argument to decide whether to execute goals
const executeGoalsArg = process.argv.includes("--execute");
main(executeGoalsArg);
