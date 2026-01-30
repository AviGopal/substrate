#!/usr/bin/env python3
"""
Simple Reliable Delegation - Quick Fix for DevBob Reliability Issues

Based on our dogfooding experience, this provides immediate reliability improvements:
1. Container health checks
2. Timeout management
3. Retry logic with backoff
4. Graceful failure handling
5. Learning from delegation patterns

Quick implementation to get DevBob dogfooding more reliable ASAP.
"""

import asyncio
import subprocess
import time
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional


class DelegationResult:
    """Result of a delegation attempt."""

    def __init__(
        self, success: bool, message: str, duration: float = 0, attempts: int = 1
    ):
        self.success = success
        self.message = message
        self.duration = duration
        self.attempts = attempts
        self.timestamp = datetime.now()


class SimpleReliableDelegator:
    """Simple reliable delegation with health checks and retries."""

    def __init__(self):
        self.delegation_history = []
        self.container_health = {}

        # Configuration
        self.max_retries = 3
        self.base_timeout = 120
        self.retry_delays = [10, 20, 30]

        # Container targets
        self.containers = {
            "opencode": "docker://devbob-opencode-dev",
            "rpc-api": "docker://devbob-rpc-api-dev",
            "cli": "docker://devbob-cli-dev",
            "dashboard": "docker://devbob-dashboard-dev",
        }

        # Fallback chains
        self.fallbacks = {
            "opencode": ["rpc-api", "cli"],
            "rpc-api": ["opencode", "cli"],
            "cli": ["opencode", "rpc-api"],
            "dashboard": ["opencode"],
        }

    def check_container_health(self, container_name: str) -> bool:
        """Quick container health check using docker ps."""

        try:
            # Remove docker:// prefix
            container = container_name.replace("docker://", "")

            # Check if container is running
            result = subprocess.run(
                [
                    "docker",
                    "ps",
                    "--format",
                    "{{.Names}}",
                    "--filter",
                    f"name={container}",
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )

            is_running = container in result.stdout

            if is_running:
                # Quick health check - try to exec a simple command
                health_result = subprocess.run(
                    ["docker", "exec", container, "echo", "health_check"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                is_healthy = health_result.returncode == 0
            else:
                is_healthy = False

            self.container_health[container] = is_healthy
            return is_healthy

        except Exception as e:
            print(f"⚠️ Health check failed for {container_name}: {e}")
            self.container_health[container_name] = False
            return False

    def get_healthy_container(self, preferred: str) -> Optional[str]:
        """Get a healthy container, trying preferred first, then fallbacks."""

        # Try preferred container
        preferred_target = self.containers.get(preferred)
        if preferred_target and self.check_container_health(preferred_target):
            return preferred_target

        print(f"⚠️ Preferred container {preferred} not healthy, trying fallbacks...")

        # Try fallbacks
        fallback_list = self.fallbacks.get(preferred, [])
        for fallback in fallback_list:
            fallback_target = self.containers.get(fallback)
            if fallback_target and self.check_container_health(fallback_target):
                print(f"✅ Using healthy fallback: {fallback}")
                return fallback_target

        # Return preferred anyway (may fail, but we'll retry)
        print(f"⚠️ No healthy containers found, will attempt with {preferred}")
        return preferred_target

    async def delegate_with_reliability(
        self,
        preferred_container: str,
        task_description: str,
        prompt: str,
        timeout: Optional[int] = None,
    ) -> DelegationResult:
        """Delegate with reliability improvements."""

        if timeout is None:
            timeout = self.base_timeout
        start_time = time.time()

        print(f"🚀 Reliable delegation: {task_description}")
        print(f"   Preferred: {preferred_container}, Timeout: {timeout}s")

        for attempt in range(self.max_retries):
            if attempt > 0:
                delay = self.retry_delays[min(attempt, len(self.retry_delays) - 1)]
                print(f"   ⏳ Retry {attempt}: waiting {delay}s...")
                await asyncio.sleep(delay)

            # Get healthy container
            target = self.get_healthy_container(preferred_container)
            if not target:
                return DelegationResult(
                    success=False,
                    message="No healthy containers available",
                    duration=time.time() - start_time,
                    attempts=attempt + 1,
                )

            print(f"   🎯 Attempt {attempt + 1}: {target}")

            try:
                # Simulate delegation (replace with real acp_delegate)
                result = await self._simulate_delegation_call(
                    target, task_description, prompt, timeout
                )

                duration = time.time() - start_time
                delegation_result = DelegationResult(
                    success=True,
                    message=f"Success: {result['message']}",
                    duration=duration,
                    attempts=attempt + 1,
                )

                self.delegation_history.append(
                    {
                        "target": target,
                        "task": task_description,
                        "result": delegation_result,
                        "timestamp": delegation_result.timestamp,
                    }
                )

                print(f"   ✅ SUCCESS on attempt {attempt + 1} ({duration:.1f}s)")
                return delegation_result

            except asyncio.TimeoutError:
                print(f"   ⏰ Timeout on attempt {attempt + 1}")
                continue

            except Exception as e:
                print(f"   ❌ Error on attempt {attempt + 1}: {e}")
                continue

        # All attempts failed
        duration = time.time() - start_time
        failure_result = DelegationResult(
            success=False,
            message=f"Failed after {self.max_retries} attempts",
            duration=duration,
            attempts=self.max_retries,
        )

        self.delegation_history.append(
            {
                "target": target,
                "task": task_description,
                "result": failure_result,
                "timestamp": failure_result.timestamp,
            }
        )

        print(f"   ❌ FAILED after {self.max_retries} attempts ({duration:.1f}s)")
        return failure_result

    async def _simulate_delegation_call(
        self, target: str, task: str, prompt: str, timeout: int
    ):
        """Simulate acp_delegate call (replace with real implementation)."""

        import random

        # Simulate work time
        work_time = random.uniform(5, min(timeout * 0.7, 60))
        await asyncio.sleep(min(work_time, 2))  # Cap for demo

        # Simulate failure scenarios based on current issues
        container = target.replace("docker://", "")
        is_healthy = self.container_health.get(container, False)

        if not is_healthy:
            if random.random() < 0.7:  # 70% chance of failure for unhealthy
                raise Exception("Container communication failed")

        # Occasional timeout simulation
        if random.random() < 0.15:  # 15% chance
            raise asyncio.TimeoutError("Simulated timeout")

        # Occasional other failures
        if random.random() < 0.1:  # 10% chance
            raise Exception("Simulated internal error")

        # Success
        return {
            "message": f"Completed {task} successfully",
            "target": target,
            "duration": work_time,
        }

    def get_reliability_stats(self) -> Dict:
        """Get reliability statistics."""

        if not self.delegation_history:
            return {"message": "No delegation history"}

        total = len(self.delegation_history)
        successful = len([h for h in self.delegation_history if h["result"].success])

        avg_duration = (
            sum(h["result"].duration for h in self.delegation_history) / total
        )
        avg_attempts = (
            sum(h["result"].attempts for h in self.delegation_history) / total
        )

        return {
            "total_delegations": total,
            "success_count": successful,
            "success_rate": successful / total if total > 0 else 0,
            "avg_duration": avg_duration,
            "avg_attempts": avg_attempts,
            "container_health": self.container_health,
        }


async def demo_simple_reliability():
    """Quick demo of reliable delegation."""

    print("🛡️ Simple Reliable Delegation - Quick Demo")
    print("=" * 50)
    print("Addressing DevBob delegation reliability issues")
    print()

    delegator = SimpleReliableDelegator()

    # Test delegation tasks
    test_tasks = [
        (
            "opencode",
            "Analyze codebase for issues",
            "Run metabob analysis on our implementation",
        ),
        ("rpc-api", "Deploy parameter server", "Get parameter server endpoints live"),
        (
            "cli",
            "Test reliability improvements",
            "Validate the new delegation patterns",
        ),
    ]

    print("🧪 Testing reliable delegation patterns...")

    for container, task_desc, prompt in test_tasks:
        print(f"\n📋 Task: {task_desc}")

        result = await delegator.delegate_with_reliability(
            preferred_container=container,
            task_description=task_desc,
            prompt=prompt,
            timeout=90,
        )

        if result.success:
            print(
                f"   ✅ Completed in {result.duration:.1f}s with {result.attempts} attempts"
            )
        else:
            print(f"   ❌ Failed: {result.message}")

    # Show reliability statistics
    print(f"\n📊 Reliability Statistics")
    print("=" * 30)

    stats = delegator.get_reliability_stats()

    print(f"📈 Performance:")
    print(f"   Success Rate: {stats['success_rate']:.1%}")
    print(f"   Average Duration: {stats['avg_duration']:.1f}s")
    print(f"   Average Attempts: {stats['avg_attempts']:.1f}")

    print(f"\n🏥 Container Health:")
    for container, healthy in stats["container_health"].items():
        status = "✅ Healthy" if healthy else "❌ Unhealthy"
        print(f"   {container}: {status}")

    print(f"\n💡 Reliability Insights:")
    if stats["success_rate"] >= 0.7:
        print("   ✅ Good reliability - system is working well")
    else:
        print("   ⚠️ Poor reliability - containers need attention")

    if stats["avg_attempts"] <= 1.5:
        print("   ✅ Efficient - most tasks succeed quickly")
    else:
        print("   ⚠️ Multiple retries needed - check container health")

    unhealthy_containers = [c for c, h in stats["container_health"].items() if not h]
    if unhealthy_containers:
        print(f"   🔧 Fix these containers: {', '.join(unhealthy_containers)}")

    print(f"\n🚀 Ready for reliable DevBob dogfooding!")

    # Return delegator for further use
    return delegator


async def main():
    """Main entry point."""
    await demo_simple_reliability()


if __name__ == "__main__":
    asyncio.run(main())
