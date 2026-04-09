#!/usr/bin/env python3
"""
Automated Bug Detection Tool for MiniBob Execution Logs
Analyzes execution logs to identify systematic bugs and patterns
"""

import re
import json
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class BugPattern:
    """Represents a detected bug pattern"""
    bug_type: str
    severity: str
    description: str
    affected_files: List[str]
    failure_rate: float
    evidence: List[str]
    fix_suggestion: Optional[str] = None

class MiniBobLogAnalyzer:
    """Automated bug detection for MiniBob execution logs"""
    
    def __init__(self, log_path: str):
        self.log_path = Path(log_path)
        self.log_content = self._read_log()
        self.detected_bugs = []
    
    def _read_log(self) -> str:
        """Read the execution log file"""
        try:
            with open(self.log_path, 'r') as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"Log file not found: {self.log_path}")
    
    def detect_bugs(self) -> List[BugPattern]:
        """Main method to detect all bug patterns"""
        patterns = []
        patterns.extend(self._detect_mathematical_errors())
        patterns.extend(self._detect_high_failure_rates())
        self.detected_bugs = patterns
        return patterns
    
    def _detect_mathematical_errors(self) -> List[BugPattern]:
        """Detect mathematical operation errors"""
        patterns = []
        expect_pattern = r'Expected: (-?\d+)\s+Received: (-?\d+)'
        matches = re.findall(expect_pattern, self.log_content)
        
        if len(matches) >= 2:
            affected_files = self._extract_affected_files()
            pattern = BugPattern(
                bug_type="Logic Error - Mathematical Operation",
                severity="HIGH",
                description="Systematic mathematical operation error detected",
                affected_files=affected_files,
                failure_rate=self._calculate_failure_rate(),
                evidence=[f"Expected: {e}, Received: {r}" for e, r in matches],
                fix_suggestion="Check for copy-paste errors in mathematical operations (+ vs -)"
            )
            patterns.append(pattern)
        return patterns
    
    def _detect_high_failure_rates(self) -> List[BugPattern]:
        """Detect high test failure rates"""
        patterns = []
        failure_rate_pattern = r'(\d+)/(\d+) tests failing \((\d+)% failure rate'
        match = re.search(failure_rate_pattern, self.log_content)
        
        if match:
            failed, total, percentage = match.groups()
            failure_rate = int(percentage)
            
            if failure_rate >= 15:
                pattern = BugPattern(
                    bug_type="High Failure Rate",
                    severity="HIGH" if failure_rate >= 50 else "MEDIUM",
                    description=f"High test failure rate detected: {failure_rate}%",
                    affected_files=self._extract_affected_files(),
                    failure_rate=failure_rate / 100,
                    evidence=[f"{failed}/{total} tests failing ({failure_rate}%)"],
                    fix_suggestion="Investigate systematic issues affecting multiple tests"
                )
                patterns.append(pattern)
        return patterns
    
    def _extract_affected_files(self) -> List[str]:
        """Extract file names from log"""
        file_pattern = r'([\w/.-]+\.(?:ts|js|py|test\.\w+))'
        files = re.findall(file_pattern, self.log_content)
        return list(set(files))
    
    def _calculate_failure_rate(self) -> float:
        """Calculate failure rate from log"""
        failure_rate_pattern = r'(\d+)/(\d+) tests failing \((\d+)% failure rate'
        match = re.search(failure_rate_pattern, self.log_content)
        return int(match.group(3)) / 100 if match else 0.0
    
    def generate_report(self) -> Dict:
        """Generate bug detection report"""
        bugs = self.detect_bugs()
        return {
            "total_bugs_detected": len(bugs),
            "high_severity_count": len([b for b in bugs if b.severity == "HIGH"]),
            "bugs": [{
                "type": bug.bug_type,
                "severity": bug.severity,
                "description": bug.description,
                "affected_files": bug.affected_files,
                "failure_rate": bug.failure_rate,
                "evidence": bug.evidence,
                "fix_suggestion": bug.fix_suggestion
            } for bug in bugs]
        }

if __name__ == "__main__":
    analyzer = MiniBobLogAnalyzer("minibob-execution.log")
    report = analyzer.generate_report()
    print(json.dumps(report, indent=2))
