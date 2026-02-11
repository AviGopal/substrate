#!/usr/bin/env node

/**
 * Memory Diagnostics Report for metabob-opencode process (PID 907409)
 * Analyzes memory usage without stopping the process
 */

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const PID = 907409;

console.log('========================================');
console.log('METABOB-OPENCODE MEMORY DIAGNOSTIC REPORT');
console.log('========================================\n');

// 1. Process Info
console.log('1. PROCESS INFORMATION');
console.log('----------------------');
try {
  const psInfo = execSync(`ps -p ${PID} -o pid,ppid,cmd,etime,%mem,rss,vsz`, { encoding: 'utf-8' });
  console.log(psInfo);
} catch (e) {
  console.error('Failed to get process info:', e.message);
}

// 2. Memory Breakdown
console.log('\n2. MEMORY BREAKDOWN');
console.log('-------------------');
try {
  const status = readFileSync(`/proc/${PID}/status`, 'utf-8');
  const memFields = ['VmSize', 'VmRSS', 'VmData', 'VmStk', 'VmExe', 'VmLib', 'Threads'];
  memFields.forEach(field => {
    const match = status.match(new RegExp(`^${field}:\\s+(.+)$`, 'm'));
    if (match) {
      console.log(`${field.padEnd(15)}: ${match[1]}`);
    }
  });
} catch (e) {
  console.error('Failed to read /proc status:', e.message);
}

// 3. Memory Maps Summary
console.log('\n3. MEMORY MAPS SUMMARY');
console.log('----------------------');
try {
  const smapsRollup = readFileSync(`/proc/${PID}/smaps_rollup`, 'utf-8');
  const important = ['Rss', 'Pss', 'Private_Clean', 'Private_Dirty', 'Swap'];
  important.forEach(field => {
    const match = smapsRollup.match(new RegExp(`^${field}:\\s+(.+)$`, 'm'));
    if (match) {
      console.log(`${field.padEnd(15)}: ${match[1]}`);
    }
  });
} catch (e) {
  console.error('Failed to read smaps_rollup:', e.message);
}

// 4. Heap Statistics (if available via V8)
console.log('\n4. FILE DESCRIPTOR COUNT');
console.log('------------------------');
try {
  const fdCount = execSync(`ls /proc/${PID}/fd | wc -l`, { encoding: 'utf-8' }).trim();
  console.log(`Open file descriptors: ${fdCount}`);
} catch (e) {
  console.error('Failed to count FDs:', e.message);
}

// 5. Process Age
console.log('\n5. PROCESS RUNTIME');
console.log('------------------');
try {
  const stat = readFileSync(`/proc/${PID}/stat`, 'utf-8');
  const starttime = parseInt(stat.split(' ')[21]);
  const uptimeSecs = parseInt(readFileSync('/proc/uptime', 'utf-8').split(' ')[0]);
  const clockTicks = parseInt(execSync('getconf CLK_TCK', { encoding: 'utf-8' }).trim());
  const processAgeSecs = uptimeSecs - (starttime / clockTicks);
  const hours = Math.floor(processAgeSecs / 3600);
  const minutes = Math.floor((processAgeSecs % 3600) / 60);
  console.log(`Process has been running for: ${hours}h ${minutes}m`);
} catch (e) {
  console.error('Failed to calculate uptime:', e.message);
}

// 6. Memory Growth Rate Estimate
console.log('\n6. MEMORY GROWTH ESTIMATE');
console.log('-------------------------');
try {
  const status = readFileSync(`/proc/${PID}/status`, 'utf-8');
  const rssMatch = status.match(/^VmRSS:\s+(\d+) kB$/m);
  const swapMatch = status.match(/^Swap:\s+(\d+) kB$/m) || 
                   readFileSync(`/proc/${PID}/smaps_rollup`, 'utf-8').match(/^Swap:\s+(\d+) kB$/m);
  
  const stat = readFileSync(`/proc/${PID}/stat`, 'utf-8');
  const starttime = parseInt(stat.split(' ')[21]);
  const uptimeSecs = parseInt(readFileSync('/proc/uptime', 'utf-8').split(' ')[0]);
  const clockTicks = parseInt(execSync('getconf CLK_TCK', { encoding: 'utf-8' }).trim());
  const processAgeSecs = uptimeSecs - (starttime / clockTicks);
  
  if (rssMatch) {
    const rssKB = parseInt(rssMatch[1]);
    const swapKB = swapMatch ? parseInt(swapMatch[1]) : 0;
    const totalMemKB = rssKB + swapKB;
    const totalMemMB = totalMemKB / 1024;
    const growthRateMBPerHour = (totalMemMB / (processAgeSecs / 3600));
    
    console.log(`Current RSS: ${(rssKB / 1024).toFixed(2)} MB`);
    console.log(`Current Swap: ${(swapKB / 1024).toFixed(2)} MB`);
    console.log(`Total Memory: ${totalMemMB.toFixed(2)} MB`);
    console.log(`Growth Rate: ${growthRateMBPerHour.toFixed(2)} MB/hour`);
    console.log(`Projected 24h: ${(totalMemMB + growthRateMBPerHour * 18).toFixed(2)} MB (if linear)`);
  }
} catch (e) {
  console.error('Failed to calculate growth rate:', e.message);
}

// 7. Recommendations
console.log('\n7. ANALYSIS & RECOMMENDATIONS');
console.log('------------------------------');
try {
  const status = readFileSync(`/proc/${PID}/status`, 'utf-8');
  const rssMatch = status.match(/^VmRSS:\s+(\d+) kB$/m);
  const dataMatch = status.match(/^VmData:\s+(\d+) kB$/m);
  
  if (rssMatch && dataMatch) {
    const rssMB = parseInt(rssMatch[1]) / 1024;
    const dataMB = parseInt(dataMatch[1]) / 1024;
    
    console.log(`\nMemory Usage Analysis:`);
    console.log(`- Physical RAM: ${rssMB.toFixed(0)} MB`);
    console.log(`- Heap/Data: ${dataMB.toFixed(0)} MB (${((dataMB / rssMB) * 100).toFixed(1)}% of RSS)`);
    
    if (rssMB > 10000) {
      console.log(`\n⚠️  CRITICAL: Memory usage is extremely high (${rssMB.toFixed(0)} MB)`);
      console.log('   Likely causes:');
      console.log('   - Unbounded Map/Set accumulation');
      console.log('   - Message history not being cleaned up');
      console.log('   - Impulse cache growing without bounds');
      console.log('   - Session context tracking old sessions');
    } else if (rssMB > 5000) {
      console.log(`\n⚠️  WARNING: Memory usage is high (${rssMB.toFixed(0)} MB)`);
      console.log('   Should investigate potential memory leaks');
    } else {
      console.log(`\n✓ Memory usage appears normal (${rssMB.toFixed(0)} MB)`);
    }
    
    console.log(`\nRecommended Actions:`);
    console.log('1. Check SessionContext.getMemoryStats() in the running process');
    console.log('2. Verify cleanup intervals are running (every 5 minutes)');
    console.log('3. Check if old sessions are being removed');
    console.log('4. Consider adding memory monitoring endpoints');
    console.log('5. Implement graceful degradation at memory thresholds');
  }
} catch (e) {
  console.error('Failed to generate recommendations:', e.message);
}

console.log('\n========================================');
console.log('END OF DIAGNOSTIC REPORT');
console.log('========================================\n');
