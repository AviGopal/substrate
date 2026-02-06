#!/usr/bin/env python3
"""
OpenCode Memory Profiler - Tracks memory leak in real-time

This script continuously monitors the OpenCode process to identify
memory leak patterns, heap growth, and swap usage.
"""

import psutil
import time
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
import sys


class OpenCodeMemoryProfiler:
    def __init__(
        self,
        pid: int,
        log_path: str = "./opencode_memory_profile.log",
        interval: int = 30,  # Check every 30 seconds
        heap_snapshot_interval: int = 300,  # Heap snapshot every 5 minutes
    ):
        """Initialize OpenCode Memory Profiler"""
        self.pid = pid
        self.log_path = log_path
        self.interval = interval
        self.heap_snapshot_interval = heap_snapshot_interval
        self.start_time = datetime.now()
        self.snapshot_count = 0

        # Create log directory
        os.makedirs(os.path.dirname(log_path), exist_ok=True)

        # Initialize process
        try:
            self.process = psutil.Process(pid)
            print(f"✅ Monitoring OpenCode process {pid}: {self.process.name()}")
        except psutil.NoSuchProcess:
            print(f"❌ Process {pid} not found")
            sys.exit(1)

    def get_process_memory_info(self) -> Optional[Dict[str, Any]]:
        """Get comprehensive memory information"""
        try:
            # Basic memory info
            memory_info = self.process.memory_info()
            memory_percent = self.process.memory_percent()
            cpu_percent = self.process.cpu_percent()

            # Get memory details from /proc/{pid}/status
            status_path = f"/proc/{self.pid}/status"
            vm_info: Dict[str, int] = {}

            if os.path.exists(status_path):
                with open(status_path, "r") as f:
                    for line in f:
                        if line.startswith(
                            (
                                "VmSize:",
                                "VmRSS:",
                                "VmData:",
                                "VmStk:",
                                "VmExe:",
                                "VmLib:",
                                "VmSwap:",
                            )
                        ):
                            parts = line.split()
                            key = parts[0].rstrip(":")
                            value_kb = int(parts[1]) if len(parts) > 1 else 0
                            vm_info[key] = value_kb * 1024  # Convert to bytes

            # System memory info
            system_memory = psutil.virtual_memory()
            swap_memory = psutil.swap_memory()

            return {
                "timestamp": datetime.now().isoformat(),
                "runtime_seconds": (datetime.now() - self.start_time).total_seconds(),
                "process": {
                    "pid": self.pid,
                    "rss": memory_info.rss,
                    "vms": memory_info.vms,
                    "memory_percent": memory_percent,
                    "cpu_percent": cpu_percent,
                    "vm_size": vm_info.get("VmSize", 0),
                    "vm_rss": vm_info.get("VmRSS", 0),
                    "vm_data": vm_info.get("VmData", 0),
                    "vm_swap": vm_info.get("VmSwap", 0),
                },
                "system": {
                    "total_ram": system_memory.total,
                    "available_ram": system_memory.available,
                    "used_ram": system_memory.used,
                    "ram_percent": system_memory.percent,
                    "total_swap": swap_memory.total,
                    "used_swap": swap_memory.used,
                    "swap_percent": swap_memory.percent,
                },
            }

        except psutil.NoSuchProcess:
            print(f"❌ Process {self.pid} terminated")
            return None

    def take_heap_snapshot(self) -> Optional[str]:
        """Attempt to take a Node.js heap snapshot"""
        try:
            # Try to send SIGUSR1 to trigger heap dump (if supported)
            timestamp = int(time.time())
            snapshot_path = f"./heap_snapshots/opencode_heap_{self.snapshot_count:04d}_{timestamp}.heapsnapshot"

            # Create directory
            os.makedirs(os.path.dirname(snapshot_path), exist_ok=True)

            # For now, just log that we would take a snapshot
            # In a real implementation, we'd need to instrument the Node.js process
            self.snapshot_count += 1

            print(
                f"📸 Heap snapshot #{self.snapshot_count} would be saved to {snapshot_path}"
            )
            return snapshot_path

        except Exception as e:
            print(f"⚠️ Could not take heap snapshot: {e}")
            return None

    def analyze_memory_growth(
        self, current_data: Dict[str, Any], previous_data: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze memory growth between two measurements"""
        if not previous_data:
            return {}

        time_diff = current_data["runtime_seconds"] - previous_data["runtime_seconds"]

        growth: Dict[str, Any] = {}
        for key in ["rss", "vms", "vm_data", "vm_swap"]:
            if key in current_data["process"] and key in previous_data["process"]:
                current_val = current_data["process"][key]
                previous_val = previous_data["process"][key]

                absolute_growth = current_val - previous_val
                rate_per_hour = (
                    (absolute_growth / time_diff * 3600) if time_diff > 0 else 0
                )

                growth[key] = {
                    "absolute_bytes": absolute_growth,
                    "absolute_mb": absolute_growth / (1024 * 1024),
                    "rate_mb_per_hour": rate_per_hour / (1024 * 1024),
                }

        return growth

    def format_bytes(self, bytes_val: float) -> str:
        """Format bytes in human readable format"""
        for unit in ["B", "KB", "MB", "GB"]:
            if bytes_val < 1024:
                return f"{bytes_val:.1f} {unit}"
            bytes_val /= 1024
        return f"{bytes_val:.1f} TB"

    def log_memory_data(
        self, data: Dict[str, Any], growth: Optional[Dict[str, Any]] = None
    ):
        """Log memory data to file and console"""
        # Log to file
        with open(self.log_path, "a") as f:
            f.write(json.dumps(data) + "\n")

        # Console output
        runtime_str = f"{data['runtime_seconds'] / 60:.1f}m"
        rss_str = self.format_bytes(data["process"]["rss"])
        vms_str = self.format_bytes(data["process"]["vms"])
        vm_data_str = self.format_bytes(data["process"]["vm_data"])
        vm_swap_str = self.format_bytes(data["process"]["vm_swap"])

        print(f"\n📊 Memory Report ({runtime_str} runtime)")
        print(f"   RSS: {rss_str} ({data['process']['memory_percent']:.1f}%)")
        print(f"   VMS: {vms_str}")
        print(f"   Heap: {vm_data_str}")
        print(f"   Swap: {vm_swap_str}")
        print(f"   CPU: {data['process']['cpu_percent']:.1f}%")

        if growth:
            print(f"\n📈 Growth Rates (per hour):")
            for key, info in growth.items():
                if info["rate_mb_per_hour"] != 0:
                    print(
                        f"   {key.upper()}: {info['rate_mb_per_hour']:+.1f} MB/h ({info['absolute_mb']:+.1f} MB)"
                    )

    def monitor(self):
        """Main monitoring loop"""
        print(f"🔍 Starting memory profiler for PID {self.pid}")
        print(f"📝 Logging to: {self.log_path}")
        print(f"⏱️  Check interval: {self.interval}s")
        print(f"📸 Heap snapshot interval: {self.heap_snapshot_interval}s")

        previous_data: Optional[Dict[str, Any]] = None
        last_heap_snapshot = 0.0

        try:
            while True:
                current_data = self.get_process_memory_info()
                if current_data is None:
                    break

                # Analyze growth
                growth = self.analyze_memory_growth(current_data, previous_data)

                # Log data
                self.log_memory_data(current_data, growth)

                # Take heap snapshot if needed
                if (time.time() - last_heap_snapshot) >= self.heap_snapshot_interval:
                    self.take_heap_snapshot()
                    last_heap_snapshot = time.time()

                previous_data = current_data
                time.sleep(self.interval)

        except KeyboardInterrupt:
            print(f"\n🛑 Monitoring stopped by user")
        except Exception as e:
            print(f"❌ Monitoring error: {e}")


def main():
    if len(sys.argv) != 2:
        print("Usage: python3 profile_opencode_memory.py <PID>")
        sys.exit(1)

    try:
        pid = int(sys.argv[1])
        profiler = OpenCodeMemoryProfiler(pid)
        profiler.monitor()
    except ValueError:
        print("❌ PID must be a number")
        sys.exit(1)


if __name__ == "__main__":
    main()
