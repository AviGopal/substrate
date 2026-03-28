#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TARGET_DIR = '/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode';
const SRC_DIR = path.join(TARGET_DIR, 'src');
const OUTPUT_PATH = '/home/avi/documents/work/exp-repo/metabob-devbob/DEPENDENCY_GRAPH.json';

function findTargetFiles() {
  try {
    const cmd = `cd "${TARGET_DIR}" && find src -name "*.ts" | grep -E "(session/activity|session/impulse|session/memory|^src/acp/|tool/activity|tool/impulse|tool/memory|tool/acp)"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    return output.trim().split('\n').filter(f => f.length > 0);
  } catch (error) {
    console.error('Error finding target files:', error.message);
    return [];
  }
}

function getCategory(filePath) {
  if (filePath.includes('/activity')) return 'activity';
  if (filePath.includes('/impulse')) return 'impulse';  
  if (filePath.includes('/memory')) return 'memory';
  if (filePath.includes('/acp')) return 'acp';
  return 'other';
}

function extractImports(filePath) {
  try {
    const fullPath = path.join(TARGET_DIR, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    const imports = [];
    
    const importRegex = /^import\s+.*?\s+from\s+['"](.*?)['"];?/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      let importPath = match[1];
      
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const dir = path.dirname(filePath);
        importPath = path.normalize(path.join(dir, importPath));
        
        if (!importPath.endsWith('.ts') && !importPath.endsWith('.js')) {
          importPath += '.ts';
        }
        
        if (importPath.startsWith('src/')) {
          importPath = importPath.substring(4);
        }
      }
      
      imports.push(importPath);
    }
    
    return imports;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return [];
  }
}

function findImportedBy(targetFile, allFiles) {
  const importedBy = [];
  
  for (const file of allFiles) {
    try {
      const fullPath = path.join(TARGET_DIR, 'src', file);
      if (!fs.existsSync(fullPath)) continue;
      
      const content = fs.readFileSync(fullPath, 'utf8');
      
      const targetWithoutExt = targetFile.replace('.ts', '');
      const patterns = [
        `from ['"\`]./${targetWithoutExt}['"\`]`,
        `from ['"\`]../${targetWithoutExt}['"\`]`,
        `from ['"\`]${targetFile}['"\`]`,
        `from ['"\`]${targetWithoutExt}['"\`]`
      ];
      
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'g');
        if (regex.test(content)) {
          importedBy.push(file);
          break;
        }
      }
    } catch (error) {
      // Skip files that can't be read
    }
  }
  
  return [...new Set(importedBy)];
}

function countLOC(filePath) {
  try {
    const fullPath = path.join(TARGET_DIR, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

function main() {
  console.log('Finding target files...');
  const targetFiles = findTargetFiles();
  console.log(`Found ${targetFiles.length} target files`);
  
  console.log('Finding all TypeScript files for cross-reference...');
  let allFiles = [];
  try {
    const cmd = `cd "${TARGET_DIR}" && find src -name "*.ts"`;
    const output = execSync(cmd, { encoding: 'utf8' });
    allFiles = output.trim().split('\n').map(f => f.replace('src/', ''));
  } catch (error) {
    console.error('Error finding all files:', error.message);
  }
  
  console.log('Analyzing dependencies...');
  const files = [];
  
  for (const file of targetFiles) {
    const relativePath = file.replace('src/', '');
    console.log(`Processing ${relativePath}...`);
    
    const imports = extractImports(file);
    const importedBy = findImportedBy(relativePath, allFiles);
    const category = getCategory(file);
    const loc = countLOC(file);
    
    const fileData = {
      path: relativePath,
      imports: imports,
      importedBy: importedBy,
      category: category,
      loc: loc
    };
    
    files.push(fileData);
  }
  
  const stats = {
    totalFiles: files.length,
    totalLOC: files.reduce((sum, f) => sum + f.loc, 0),
    byCategory: {}
  };
  
  for (const file of files) {
    if (!stats.byCategory[file.category]) {
      stats.byCategory[file.category] = { count: 0, loc: 0 };
    }
    stats.byCategory[file.category].count++;
    stats.byCategory[file.category].loc += file.loc;
  }
  
  const result = {
    files: files,
    circularDeps: [],
    stats: stats
  };
  
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(`\nDependency analysis complete!`);
  console.log(`Results written to: ${OUTPUT_PATH}`);
  console.log(`\nStats:`);
  console.log(`- Total files: ${stats.totalFiles}`);
  console.log(`- Total LOC: ${stats.totalLOC}`);
  console.log(`- By category:`, JSON.stringify(stats.byCategory, null, 2));
}

main();