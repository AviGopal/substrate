#!/usr/bin/env python3
"""
E2E Validation Script for Phase 1 Impulse Binding
Tests complete communication flow: metabob-cli → metabob-rpc-api → SurrealDB

Usage:
    python3 scripts/e2e-phase1-impulse-binding-validation.py
    
Environment Variables:
    METABOB_API_KEY: API key for authentication
    METABOB_API_URL: Base URL for API (default: http://localhost:8000)
    PROJECT_ID: Project ID for multi-tenancy (default: proj_test_e2e)
"""

import os
import sys
import json
import time
import random
import string
import requests
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

# Configuration
API_KEY = os.getenv("METABOB_API_KEY", "test-api-key")
API_URL = os.getenv("METABOB_API_URL", "http://localhost:8000")
PROJECT_ID = os.getenv("PROJECT_ID", "proj_test_e2e")

@dataclass
class ValidationResult:
    """Result of a validation step"""
    step: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None
    
    def to_dict(self):
        return asdict(self)

class Phase1E2EValidator:
    """E2E validation harness for Phase 1 impulse binding"""
    
    def __init__(self, api_url: str, api_key: str, project_id: str):
        self.api_url = api_url.rstrip('/')
        self.api_key = api_key
        self.project_id = project_id
        self.headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        }
        self.results: List[ValidationResult] = []
        
    def _random_id(self, prefix: str = "test-e2e") -> str:
        """Generate random test ID"""
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"{prefix}-{suffix}"
    
    def _log(self, message: str):
        """Log validation message"""
        print(f"[E2E] {message}", flush=True)
    
    def _add_result(self, step: str, passed: bool, message: str, details: Optional[Dict] = None):
        """Record validation result"""
        result = ValidationResult(step, passed, message, details)
        self.results.append(result)
        status = "✅ PASS" if passed else "❌ FAIL"
        self._log(f"{status} - {step}: {message}")
        
    def validate_step1_create_test_results(self) -> Optional[str]:
        """Step 2: Create testResults impulse with random data"""
        impulse_id = self._random_id("test-results")
        
        payload = {
            "impulse_id": impulse_id,
            "project_id": self.project_id,
            "impulse_data": {
                "id": impulse_id,
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "command": "pytest tests/unit/",
                    "exit_code": 0,
                    "passed": True,
                    "output": f"42 passed, {random.randint(1, 5)} skipped in {random.uniform(1, 10):.2f}s"
                },
                "budget": 1000
            }
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/api/v2/impulses",
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 201:
                self._add_result(
                    "Step2_CreateTestResults",
                    True,
                    f"Created testResults impulse: {impulse_id}",
                    {"status_code": 201, "response": response.json()}
                )
                return impulse_id
            else:
                self._add_result(
                    "Step2_CreateTestResults",
                    False,
                    f"Failed to create testResults impulse: HTTP {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
                
        except Exception as e:
            self._add_result(
                "Step2_CreateTestResults",
                False,
                f"Exception creating testResults impulse: {str(e)}",
                {"error": str(e)}
            )
            return None
    
    def validate_step2_retrieve_impulse(self, impulse_id: str) -> Optional[Dict]:
        """Step 4: Retrieve impulse via API and verify data integrity"""
        try:
            response = requests.get(
                f"{self.api_url}/api/v2/impulses/{impulse_id}",
                headers=self.headers,
                params={"project_id": self.project_id},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify data structure
                if "impulse_data" in data:
                    impulse_data = data["impulse_data"]
                    pointer = impulse_data.get("pointer", {})
                    
                    # Verify testResults fields
                    if (pointer.get("type") == "testResults" and
                        "command" in pointer and
                        "exit_code" in pointer and
                        "passed" in pointer):
                        
                        self._add_result(
                            "Step4_RetrieveImpulse",
                            True,
                            f"Retrieved and verified testResults impulse: {impulse_id}",
                            {"data": data}
                        )
                        return data
                    else:
                        self._add_result(
                            "Step4_RetrieveImpulse",
                            False,
                            f"Impulse data missing required fields",
                            {"data": data}
                        )
                        return None
                else:
                    self._add_result(
                        "Step4_RetrieveImpulse",
                        False,
                        f"Response missing impulse_data field",
                        {"data": data}
                    )
                    return None
            else:
                self._add_result(
                    "Step4_RetrieveImpulse",
                    False,
                    f"Failed to retrieve impulse: HTTP {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
                
        except Exception as e:
            self._add_result(
                "Step4_RetrieveImpulse",
                False,
                f"Exception retrieving impulse: {str(e)}",
                {"error": str(e)}
            )
            return None
    
    def validate_step3_create_task_summary(self) -> Optional[str]:
        """Step 5: Create taskSummary impulse"""
        impulse_id = self._random_id("task-summary")
        
        payload = {
            "impulse_id": impulse_id,
            "project_id": self.project_id,
            "impulse_data": {
                "id": impulse_id,
                "type": "taskSummary",
                "pointer": {
                    "type": "taskSummary",
                    "task_id": "task-1",
                    "success": True,
                    "duration_ms": random.randint(3000, 10000),
                    "cost": round(random.uniform(0.01, 0.1), 4),
                    "tokens": random.randint(1000, 5000)
                },
                "budget": 2000
            }
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/api/v2/impulses",
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 201:
                self._add_result(
                    "Step5_CreateTaskSummary",
                    True,
                    f"Created taskSummary impulse: {impulse_id}",
                    {"status_code": 201}
                )
                return impulse_id
            else:
                self._add_result(
                    "Step5_CreateTaskSummary",
                    False,
                    f"Failed to create taskSummary impulse: HTTP {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
                
        except Exception as e:
            self._add_result(
                "Step5_CreateTaskSummary",
                False,
                f"Exception creating taskSummary impulse: {str(e)}",
                {"error": str(e)}
            )
            return None
    
    def validate_step4_create_script_artifact(self) -> Optional[str]:
        """Step 6: Create scriptArtifact impulse"""
        impulse_id = self._random_id("script-artifact")
        
        payload = {
            "impulse_id": impulse_id,
            "project_id": self.project_id,
            "impulse_data": {
                "id": impulse_id,
                "type": "scriptArtifact",
                "pointer": {
                    "type": "scriptArtifact",
                    "file_path": f"/tmp/test-{random.randint(1000, 9999)}.sh",
                    "language": "bash",
                    "executable": True,
                    "inferred_purpose": "automated testing"
                },
                "budget": 500
            }
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/api/v2/impulses",
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 201:
                self._add_result(
                    "Step6_CreateScriptArtifact",
                    True,
                    f"Created scriptArtifact impulse: {impulse_id}",
                    {"status_code": 201}
                )
                return impulse_id
            else:
                self._add_result(
                    "Step6_CreateScriptArtifact",
                    False,
                    f"Failed to create scriptArtifact impulse: HTTP {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                return None
                
        except Exception as e:
            self._add_result(
                "Step6_CreateScriptArtifact",
                False,
                f"Exception creating scriptArtifact impulse: {str(e)}",
                {"error": str(e)}
            )
            return None
    
    def validate_step5_error_handling(self):
        """Step 8: Test error handling with invalid data"""
        payload = {
            "impulse_id": self._random_id("invalid"),
            "project_id": self.project_id,
            "impulse_data": {
                "type": "testResults",
                "pointer": {
                    "type": "testResults",
                    "command": "pytest"
                    # Missing: passed, exit_code
                }
            }
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/api/v2/impulses",
                headers=self.headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code == 400:
                self._add_result(
                    "Step8_ErrorHandling",
                    True,
                    "Correctly returned HTTP 400 for invalid testResults impulse",
                    {"status_code": 400, "response": response.json()}
                )
            else:
                self._add_result(
                    "Step8_ErrorHandling",
                    False,
                    f"Expected HTTP 400, got HTTP {response.status_code}",
                    {"status_code": response.status_code, "response": response.text}
                )
                
        except Exception as e:
            self._add_result(
                "Step8_ErrorHandling",
                False,
                f"Exception testing error handling: {str(e)}",
                {"error": str(e)}
            )
    
    def run_validation(self) -> bool:
        """Run complete E2E validation flow"""
        self._log("=" * 80)
        self._log("Phase 1 Impulse Binding E2E Validation")
        self._log("=" * 80)
        self._log(f"API URL: {self.api_url}")
        self._log(f"Project ID: {self.project_id}")
        self._log("")
        
        # Step 2: Create testResults impulse
        test_results_id = self.validate_step1_create_test_results()
        if not test_results_id:
            self._log("⚠️  Skipping subsequent steps due to testResults creation failure")
        else:
            time.sleep(1)  # Allow DB write to complete
            
            # Step 4: Retrieve and verify
            self.validate_step2_retrieve_impulse(test_results_id)
        
        # Step 5: Create taskSummary
        task_summary_id = self.validate_step3_create_task_summary()
        if task_summary_id:
            time.sleep(1)
            self.validate_step2_retrieve_impulse(task_summary_id)
        
        # Step 6: Create scriptArtifact
        script_artifact_id = self.validate_step4_create_script_artifact()
        if script_artifact_id:
            time.sleep(1)
            self.validate_step2_retrieve_impulse(script_artifact_id)
        
        # Step 8: Error handling
        self.validate_step5_error_handling()
        
        # Summary
        self._log("")
        self._log("=" * 80)
        self._log("Validation Summary")
        self._log("=" * 80)
        
        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)
        total = len(self.results)
        
        self._log(f"Total Steps: {total}")
        self._log(f"Passed: {passed}")
        self._log(f"Failed: {failed}")
        self._log(f"Success Rate: {(passed/total*100):.1f}%")
        self._log("")
        
        # Detailed results
        if failed > 0:
            self._log("Failed Steps:")
            for result in self.results:
                if not result.passed:
                    self._log(f"  ❌ {result.step}: {result.message}")
        
        # Write results to file
        results_file = "validation-results/phase1-e2e-validation-results.json"
        os.makedirs("validation-results", exist_ok=True)
        with open(results_file, "w") as f:
            json.dump([r.to_dict() for r in self.results], f, indent=2)
        self._log(f"Results written to: {results_file}")
        
        return failed == 0

def main():
    """Main entry point"""
    validator = Phase1E2EValidator(API_URL, API_KEY, PROJECT_ID)
    success = validator.run_validation()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
