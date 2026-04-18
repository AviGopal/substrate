#!/usr/bin/env bun
/**
 * Historical Validation Framework
 *
 * Tests MiniBob's capability by:
 * 1. Jumping to a random historical commit
 * 2. Reading the next N commit messages
 * 3. Generating a goal prompt from those messages
 * 4. Having MiniBob implement the changes
 * 5. Comparing MiniBob's implementation to actual historical changes
 * 6. Scoring similarity and correctness
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
}

interface ValidationConfig {
  repoPath: string;
  numCommits: number;
  minCommitAge: number; // Days in the past
  maxCommitAge: number;
  excludePatterns: string[]; // Files to exclude
  outputDir: string;
}

interface ValidationResult {
  testId: string;
  timestamp: string;
  repo: string;
  startCommit: CommitInfo;
  targetCommits: CommitInfo[];
  generatedGoal: string;
  minibobExecution: {
    success: boolean;
    duration: number;
    cost: number;
    filesModified: string[];
    error?: string;
  };
  comparison: {
    filesMatched: string[];
    filesMissing: string[];
    filesExtra: string[];
    overallSimilarity: number;
    lineMatchScore: number;
    semanticMatchScore: number;
  };
  score: number;
}

class HistoricalValidator {
  private config: ValidationConfig;
  private resultsDir: string;

  constructor(config: ValidationConfig) {
    this.config = config;
    this.resultsDir = join(config.outputDir, "results");

    if (!existsSync(this.resultsDir)) {
      mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Get all commits in the specified age range
   */
  private getCommitHistory(): CommitInfo[] {
    const { repoPath, minCommitAge, maxCommitAge } = this.config;

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - maxCommitAge);

    const untilDate = new Date();
    untilDate.setDate(untilDate.getDate() - minCommitAge);

    try {
      const gitLog = execSync(
        `git log --since="${sinceDate.toISOString()}" --until="${untilDate.toISOString()}" --format="%H|%s|%an|%aI" --no-merges`,
        { cwd: repoPath, encoding: "utf-8" }
      );

      return gitLog
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => {
          const [hash, message, author, date] = line.split("|");

          // Get files changed in this commit
          const filesOutput = execSync(
            `git diff-tree --no-commit-id --name-only -r ${hash}`,
            { cwd: repoPath, encoding: "utf-8" }
          );

          const filesChanged = filesOutput
            .trim()
            .split("\n")
            .filter((f) => f.length > 0);

          // Get stats
          const stats = execSync(
            `git show --stat --format="" ${hash}`,
            { cwd: repoPath, encoding: "utf-8" }
          );

          const statsMatch = stats.match(/(\d+) insertions?.*?(\d+) deletions?/);
          const additions = statsMatch ? parseInt(statsMatch[1]) : 0;
          const deletions = statsMatch ? parseInt(statsMatch[2]) : 0;

          return {
            hash,
            message,
            author,
            date,
            filesChanged,
            additions,
            deletions,
          };
        })
        .reverse(); // Reverse to chronological order (oldest first)
    } catch (error) {
      console.error("Failed to get commit history:", error);
      return [];
    }
  }

  /**
   * Pick a random commit as starting point
   */
  private pickRandomStartCommit(commits: CommitInfo[]): CommitInfo | null {
    const { numCommits, excludePatterns } = this.config;

    // Filter commits that have enough subsequent commits
    const validStarts = commits.slice(0, commits.length - numCommits);

    // Filter out commits that only touch excluded files
    const filtered = validStarts.filter((commit) => {
      const relevantFiles = commit.filesChanged.filter((file) =>
        !excludePatterns.some((pattern) => file.includes(pattern))
      );
      return relevantFiles.length > 0 && commit.additions + commit.deletions > 5;
    });

    if (filtered.length === 0) return null;

    return filtered[Math.floor(Math.random() * filtered.length)];
  }

  /**
   * Get the next N commits after the start commit
   */
  private getNextCommits(
    allCommits: CommitInfo[],
    startCommit: CommitInfo,
    count: number
  ): CommitInfo[] {
    const startIndex = allCommits.findIndex((c) => c.hash === startCommit.hash);
    if (startIndex === -1) return [];

    return allCommits.slice(startIndex + 1, startIndex + 1 + count);
  }

  /**
   * Generate a goal prompt from commit messages
   */
  private generateGoalPrompt(commits: CommitInfo[]): string {
    // Extract the essence of what was done
    const messages = commits.map((c) => c.message);

    // Identify common themes
    const themes = new Set<string>();
    const actions = new Set<string>();

    messages.forEach((msg) => {
      const lower = msg.toLowerCase();

      // Extract action verbs
      if (lower.startsWith("fix")) actions.add("fix");
      if (lower.startsWith("add") || lower.startsWith("implement")) actions.add("add");
      if (lower.startsWith("refactor")) actions.add("refactor");
      if (lower.startsWith("update")) actions.add("update");
      if (lower.startsWith("remove")) actions.add("remove");

      // Extract component references
      if (lower.includes("test")) themes.add("testing");
      if (lower.includes("doc")) themes.add("documentation");
      if (lower.includes("api")) themes.add("API");
      if (lower.includes("ui") || lower.includes("component")) themes.add("UI");
      if (lower.includes("auth")) themes.add("authentication");
      if (lower.includes("database") || lower.includes("schema")) themes.add("database");
    });

    // Build natural language goal
    const actionsList = Array.from(actions);
    const themesList = Array.from(themes);

    let goal = "Implement the following changes:\n\n";

    commits.forEach((commit, i) => {
      goal += `${i + 1}. ${commit.message}\n`;
    });

    goal += `\nFocus areas: ${themesList.join(", ") || "general implementation"}`;

    if (commits.length > 1) {
      goal += `\n\nThis is a ${commits.length}-part change. Implement all parts.`;
    }

    return goal;
  }

  /**
   * Checkout to a specific commit
   */
  private checkoutCommit(commit: string): void {
    const { repoPath } = this.config;
    try {
      execSync(`git checkout ${commit}`, { cwd: repoPath, stdio: "ignore" });
    } catch (error) {
      throw new Error(`Failed to checkout ${commit}: ${error}`);
    }
  }

  /**
   * Run MiniBob with the generated goal
   */
  private async runMiniBob(goal: string, workDir: string): Promise<{
    success: boolean;
    duration: number;
    cost: number;
    filesModified: string[];
    output: string;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Write goal to temp file
      const goalFile = join(workDir, ".validation-goal.txt");
      writeFileSync(goalFile, goal);

      // Run MiniBob in single-shot mode
      const output = execSync(
        `minibob --single "${goal.replace(/"/g, '\\"')}"`,
        {
          cwd: workDir,
          encoding: "utf-8",
          timeout: 300000, // 5 minute timeout
        }
      );

      const duration = Date.now() - startTime;

      // Extract files modified from git status
      const statusOutput = execSync("git status --short", {
        cwd: workDir,
        encoding: "utf-8",
      });

      const filesModified = statusOutput
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.substring(3).trim());

      // Try to extract cost from output
      const costMatch = output.match(/Cost:\s+\$?([\d.]+)/i);
      const cost = costMatch ? parseFloat(costMatch[1]) : 0;

      return {
        success: true,
        duration,
        cost,
        filesModified,
        output,
      };
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        cost: 0,
        filesModified: [],
        output: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Compare MiniBob's changes to the actual historical changes
   */
  private compareImplementations(
    workDir: string,
    targetCommits: CommitInfo[]
  ): {
    filesMatched: string[];
    filesMissing: string[];
    filesExtra: string[];
    overallSimilarity: number;
    lineMatchScore: number;
    semanticMatchScore: number;
    details: Record<string, any>;
  } {
    // Get all files that should have been changed
    const expectedFiles = new Set<string>();
    targetCommits.forEach((commit) => {
      commit.filesChanged.forEach((file) => expectedFiles.add(file));
    });

    // Get files actually changed by MiniBob
    const statusOutput = execSync("git status --short", {
      cwd: workDir,
      encoding: "utf-8",
    });

    const actualFiles = new Set<string>(
      statusOutput
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => line.substring(3).trim())
    );

    // Calculate file overlap
    const filesMatched: string[] = [];
    const filesMissing: string[] = [];
    const filesExtra: string[] = [];

    expectedFiles.forEach((file) => {
      if (actualFiles.has(file)) {
        filesMatched.push(file);
      } else {
        filesMissing.push(file);
      }
    });

    actualFiles.forEach((file) => {
      if (!expectedFiles.has(file)) {
        filesExtra.push(file);
      }
    });

    // Calculate similarity scores
    const fileMatchRatio = filesMatched.length / Math.max(expectedFiles.size, 1);

    // For matched files, compare line-by-line similarity
    let totalLineSimilarity = 0;
    let filesCompared = 0;

    filesMatched.forEach((file) => {
      try {
        // Get MiniBob's changes
        const minibobDiff = execSync(`git diff HEAD ${file}`, {
          cwd: workDir,
          encoding: "utf-8",
        });

        // Get actual historical changes (combine all target commits)
        let historicalDiff = "";
        targetCommits.forEach((commit) => {
          if (commit.filesChanged.includes(file)) {
            const commitDiff = execSync(`git show ${commit.hash}:${file}`, {
              cwd: workDir,
              encoding: "utf-8",
            });
            historicalDiff += commitDiff;
          }
        });

        // Simple line similarity (can be enhanced with better diffing algorithms)
        const minibobLines = minibobDiff.split("\n");
        const historicalLines = historicalDiff.split("\n");

        const commonLines = minibobLines.filter((line) =>
          historicalLines.includes(line)
        );

        const similarity =
          commonLines.length /
          Math.max(minibobLines.length, historicalLines.length);

        totalLineSimilarity += similarity;
        filesCompared++;
      } catch (error) {
        // Skip files that can't be compared
      }
    });

    const lineMatchScore = filesCompared > 0 ? totalLineSimilarity / filesCompared : 0;

    // Semantic match score (placeholder - could use AST comparison)
    const semanticMatchScore = lineMatchScore * 0.9; // Simplified

    const overallSimilarity = fileMatchRatio * 0.4 + lineMatchScore * 0.4 + semanticMatchScore * 0.2;

    return {
      filesMatched,
      filesMissing,
      filesExtra,
      overallSimilarity,
      lineMatchScore,
      semanticMatchScore,
      details: {
        expectedFileCount: expectedFiles.size,
        actualFileCount: actualFiles.size,
        matchedFileCount: filesMatched.length,
      },
    };
  }

  /**
   * Run a single validation test
   */
  async runValidation(): Promise<ValidationResult> {
    const testId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date().toISOString();

    console.log(`\n🔍 Starting validation test: ${testId}`);
    console.log(`⏰ Timestamp: ${timestamp}\n`);

    // Step 1: Get commit history
    console.log("📜 Fetching commit history...");
    const commits = this.getCommitHistory();
    console.log(`   Found ${commits.length} commits in range`);

    if (commits.length < this.config.numCommits + 1) {
      throw new Error("Not enough commits in the specified range");
    }

    // Step 2: Pick random start commit
    console.log("\n🎲 Selecting random start commit...");
    const startCommit = this.pickRandomStartCommit(commits);

    if (!startCommit) {
      throw new Error("Could not find suitable start commit");
    }

    console.log(`   Selected: ${startCommit.hash.substring(0, 8)} - ${startCommit.message}`);

    // Step 3: Get next N commits
    console.log(`\n📦 Getting next ${this.config.numCommits} commits...`);
    const targetCommits = this.getNextCommits(commits, startCommit, this.config.numCommits);

    if (targetCommits.length === 0) {
      throw new Error("No commits found after the start commit");
    }

    // Validate chronological order (sanity check)
    const startDate = new Date(startCommit.date);
    const invalidCommits = targetCommits.filter(c => new Date(c.date) <= startDate);
    if (invalidCommits.length > 0) {
      console.error("⚠️  Warning: Some target commits are not chronologically after start commit:");
      invalidCommits.forEach(c => {
        console.error(`   ${c.hash.substring(0, 8)} (${c.date}) is not after ${startCommit.date}`);
      });
    }

    targetCommits.forEach((commit, i) => {
      console.log(`   ${i + 1}. ${commit.hash.substring(0, 8)} - ${commit.message}`);
    });

    // Step 4: Generate goal prompt
    console.log("\n✍️  Generating goal prompt...");
    const generatedGoal = this.generateGoalPrompt(targetCommits);
    console.log(`   Goal: ${generatedGoal.substring(0, 100)}...`);

    // Step 5: Checkout to start commit
    console.log(`\n🔄 Checking out to ${startCommit.hash.substring(0, 8)}...`);
    this.checkoutCommit(startCommit.hash);

    // Step 6: Run MiniBob
    console.log("\n🤖 Running MiniBob with generated goal...");
    const minibobResult = await this.runMiniBob(generatedGoal, this.config.repoPath);

    if (minibobResult.success) {
      console.log(`   ✅ MiniBob completed successfully`);
      console.log(`   ⏱️  Duration: ${(minibobResult.duration / 1000).toFixed(2)}s`);
      console.log(`   💰 Cost: $${minibobResult.cost.toFixed(4)}`);
      console.log(`   📝 Files modified: ${minibobResult.filesModified.length}`);
    } else {
      console.log(`   ❌ MiniBob failed: ${minibobResult.error}`);
    }

    // Step 7: Compare implementations
    console.log("\n📊 Comparing implementations...");
    const comparison = this.compareImplementations(this.config.repoPath, targetCommits);

    console.log(`   Files matched: ${comparison.filesMatched.length}`);
    console.log(`   Files missing: ${comparison.filesMissing.length}`);
    console.log(`   Files extra: ${comparison.filesExtra.length}`);
    console.log(`   Overall similarity: ${(comparison.overallSimilarity * 100).toFixed(2)}%`);

    // Step 8: Calculate final score
    const score = minibobResult.success ? comparison.overallSimilarity * 100 : 0;

    console.log(`\n🎯 Final Score: ${score.toFixed(2)}/100`);

    // Step 9: Save results
    const result: ValidationResult = {
      testId,
      timestamp,
      repo: this.config.repoPath,
      startCommit,
      targetCommits,
      generatedGoal,
      minibobExecution: minibobResult,
      comparison,
      score,
    };

    const resultPath = join(this.resultsDir, `${testId}.json`);
    writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 Results saved to: ${resultPath}`);

    return result;
  }

  /**
   * Run multiple validation tests
   */
  async runBatch(count: number): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    for (let i = 0; i < count; i++) {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`Running test ${i + 1}/${count}`);
      console.log("=".repeat(80));

      try {
        const result = await this.runValidation();
        results.push(result);

        // Reset repository state
        execSync("git reset --hard HEAD", { cwd: this.config.repoPath, stdio: "ignore" });
        execSync("git checkout -", { cwd: this.config.repoPath, stdio: "ignore" });
      } catch (error) {
        console.error(`\n❌ Test ${i + 1} failed:`, error);

        // Reset repository state even on error
        try {
          execSync("git reset --hard HEAD", { cwd: this.config.repoPath, stdio: "ignore" });
          execSync("git checkout -", { cwd: this.config.repoPath, stdio: "ignore" });
        } catch {
          // Ignore cleanup errors
        }
      }

      // Wait a bit between tests
      if (i < count - 1) {
        console.log("\n⏸️  Waiting 5 seconds before next test...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    return results;
  }
}

// CLI interface
if (import.meta.main) {
  const args = process.argv.slice(2);

  const config: ValidationConfig = {
    repoPath: args[0] || process.cwd(),
    numCommits: args[1] !== undefined ? parseInt(args[1]) : 3,
    minCommitAge: args[2] !== undefined ? parseInt(args[2]) : 7, // At least 7 days old
    maxCommitAge: args[3] !== undefined ? parseInt(args[3]) : 90, // At most 90 days old
    excludePatterns: ["node_modules", "dist", "build", ".md", "package-lock.json"],
    outputDir: join(process.cwd(), "validation", "historical-validation"),
  };

  const testCount = parseInt(args[4]) || 1;

  console.log("🎯 Historical Validation Framework");
  console.log("===================================\n");
  console.log("Configuration:");
  console.log(`  Repository: ${config.repoPath}`);
  console.log(`  Commits per test: ${config.numCommits}`);
  console.log(`  Commit age range: ${config.minCommitAge}-${config.maxCommitAge} days`);
  console.log(`  Number of tests: ${testCount}`);

  const validator = new HistoricalValidator(config);

  validator
    .runBatch(testCount)
    .then((results) => {
      console.log("\n\n" + "=".repeat(80));
      console.log("📈 SUMMARY");
      console.log("=".repeat(80));
      console.log(`\nTests completed: ${results.length}`);
      console.log(`Successful: ${results.filter((r) => r.minibobExecution.success).length}`);
      console.log(`Failed: ${results.filter((r) => !r.minibobExecution.success).length}`);

      const avgScore =
        results.reduce((sum, r) => sum + r.score, 0) / results.length;
      console.log(`\nAverage score: ${avgScore.toFixed(2)}/100`);

      const avgSimilarity =
        results.reduce((sum, r) => sum + r.comparison.overallSimilarity, 0) / results.length;
      console.log(`Average similarity: ${(avgSimilarity * 100).toFixed(2)}%`);
    })
    .catch((error) => {
      console.error("\n❌ Validation failed:", error);
      process.exit(1);
    });
}

export { HistoricalValidator, ValidationConfig, ValidationResult };
