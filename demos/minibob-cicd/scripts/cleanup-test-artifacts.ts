#!/usr/bin/env bun

import { existsSync, rmSync, statSync, writeFileSync, appendFileSync } from 'fs';
import { glob } from 'glob';
import { join, dirname } from 'path';

interface CleanupConfig {
  dryRun: boolean;
  logFile: string;
  patterns: {
    safe: string[];
    risky: string[];
  };
  protectedPaths: string[];
  maxFileAge?: number; // in days
}

class TestArtifactCleaner {
  private config: CleanupConfig;
  private deletedFiles: string[] = [];
  private skippedFiles: string[] = [];
  private errors: string[] = [];

  constructor(config: CleanupConfig) {
    this.config = config;
    this.initializeLogging();
  }

  private initializeLogging(): void {
    const logDir = dirname(this.config.logFile);
    if (!existsSync(logDir)) {
      throw new Error(`Log directory ${logDir} does not exist`);
    }
    
    const timestamp = new Date().toISOString();
    const header = `\n=== Cleanup Session Started: ${timestamp} ===\n`;
    appendFileSync(this.config.logFile, header);
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;
    appendFileSync(this.config.logFile, logEntry);
    console.log(`${level}: ${message}`);
  }

  private isProtected(filePath: string): boolean {
    return this.config.protectedPaths.some(protected => 
      filePath.includes(protected) || filePath.startsWith(protected)
    );
  }

  private isFileOldEnough(filePath: string): boolean {
    if (!this.config.maxFileAge) return true;
    
    try {
      const stats = statSync(filePath);
      const fileAge = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      return fileAge > this.config.maxFileAge;
    } catch (error) {
      this.log(`Error checking file age for ${filePath}: ${error}`, 'ERROR');
      return false;
    }
  }

  private async findFiles(patterns: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { 
          ignore: ['node_modules/**', '.git/**'],
          dot: true 
        });
        allFiles.push(...files);
        this.log(`Pattern '${pattern}' found ${files.length} files`);
      } catch (error) {
        this.log(`Error with pattern '${pattern}': ${error}`, 'ERROR');
        this.errors.push(`Pattern error: ${pattern} - ${error}`);
      }
    }
    
    return [...new Set(allFiles)]; // Remove duplicates
  }

  public async cleanup(): Promise<void> {
    this.log('Starting test artifact cleanup...');
    
    // Process safe patterns first
    this.log('Processing safe cleanup patterns...');
    const safeFiles = await this.findFiles(this.config.patterns.safe);
    
    for (const file of safeFiles) {
      if (this.isProtected(file)) {
        this.log(`Skipped protected file: ${file}`, 'WARN');
        this.skippedFiles.push(file);
        continue;
      }
      
      if (!this.isFileOldEnough(file)) {
        this.log(`Skipped recent file: ${file}`, 'WARN');
        this.skippedFiles.push(file);
        continue;
      }
      
      if (this.deleteFile(file)) {
        this.deletedFiles.push(file);
      }
    }
  }

  private deleteFile(filePath: string): boolean {
    if (this.config.dryRun) {
      this.log(`[DRY RUN] Would delete: ${filePath}`);
      return true;
    }

    try {
      rmSync(filePath, { recursive: true, force: true });
      this.log(`Deleted: ${filePath}`);
      return true;
    } catch (error) {
      this.log(`Failed to delete ${filePath}: ${error}`, 'ERROR');
      this.errors.push(`Delete error: ${filePath} - ${error}`);
      return false;
    }
  }

  public generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: {
        filesDeleted: this.deletedFiles.length,
        filesSkipped: this.skippedFiles.length,
        errors: this.errors.length
      },
      deletedFiles: this.deletedFiles,
      skippedFiles: this.skippedFiles,
      errors: this.errors
    };
    
    return JSON.stringify(report, null, 2);
  }
}

export { TestArtifactCleaner, CleanupConfig };