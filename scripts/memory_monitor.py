#!/usr/bin/env python3
"""
Continuous Memory Monitoring System for DevBob

Key Features:
- Real-time host and container memory tracking
- Configurable thresholds for alerts
- Multiple notification channels
- Automatic mitigation strategies
- Persistent logging
"""

import psutil
import docker
import time
import logging
import json
import os
from datetime import datetime
from typing import Dict, List, Optional


class MemoryMonitor:
    def __init__(
        self,
        check_interval: int = 60,  # Check every minute
        host_threshold: float = 0.85,  # 85% host memory usage
        container_threshold: float = 0.90,  # 90% container memory usage
        log_path: str = "./memory_monitor.log",
        config_path: str = "./configs/memory_monitor_config.json",
    ):
        """
        Initialize Memory Monitor with configurable parameters

        :param check_interval: Seconds between memory checks
        :param host_threshold: Percentage of host memory usage to trigger alert
        :param container_threshold: Percentage of container memory usage to trigger alert
        :param log_path: Path to log memory events
        :param config_path: Path to configuration file
        """
        self.check_interval = check_interval
        self.host_threshold = host_threshold
        self.container_threshold = container_threshold

        # Logging setup
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        logging.basicConfig(
            filename=log_path,
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s: %(message)s",
        )
        self.logger = logging.getLogger(__name__)

        # Configuration
        self.config_path = config_path
        self.config = self._load_config()

        # Docker client
        self.docker_client = docker.from_env()

    def _load_config(self) -> Dict:
        """Load configuration from JSON file with defaults"""
        default_config = {
            "notification_emails": [],
            "slack_webhook_url": None,
            "mitigation_actions": {
                "high_memory": ["stop_lowest_priority_containers"],
                "critical_memory": ["stop_all_non_essential_containers"],
            },
        }

        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, "r") as f:
                    user_config = json.load(f)
                    return {**default_config, **user_config}
            else:
                return default_config
        except Exception as e:
            self.logger.error(f"Config load error: {e}")
            return default_config

    def _send_alert(self, message: str):
        """Send alerts via configured channels"""
        self.logger.warning(message)

        # Email alerts
        if self.config.get("notification_emails"):
            # Placeholder for email notification logic
            pass

        # Slack alerts
        if self.config.get("slack_webhook_url"):
            # Placeholder for Slack webhook notification
            pass

    def _get_host_memory_stats(self) -> Dict:
        """Retrieve host memory statistics"""
        memory = psutil.virtual_memory()
        return {
            "total": memory.total,
            "available": memory.available,
            "used": memory.used,
            "percent": memory.percent,
        }

    def _get_container_memory_stats(self) -> List[Dict]:
        """Retrieve memory statistics for DevBob containers"""
        containers = self.docker_client.containers.list(
            filters={"label": "com.docker.compose.project=metabob-devbob"}
        )

        stats = []
        for container in containers:
            try:
                container_stats = container.stats(stream=False)
                memory_stats = container_stats["memory_stats"]

                if "usage" in memory_stats and "limit" in memory_stats:
                    usage = memory_stats["usage"]
                    limit = memory_stats["limit"]
                    percent = (usage / limit) * 100 if limit > 0 else 0

                    stats.append(
                        {
                            "name": container.name,
                            "usage": usage,
                            "limit": limit,
                            "percent": percent,
                        }
                    )
            except Exception as e:
                self.logger.error(f"Error getting stats for {container.name}: {e}")

        return stats

    def _mitigate_high_memory(self, stats: Dict):
        """Apply mitigation strategies for high memory usage"""
        actions = self.config["mitigation_actions"].get(
            "high_memory"
            if stats["host_percent"] > self.host_threshold
            else "critical_memory",
            [],
        )

        for action in actions:
            if action == "stop_lowest_priority_containers":
                # Implement container priority stopping logic
                pass
            elif action == "stop_all_non_essential_containers":
                # Stop all non-essential containers
                pass

    def monitor(self):
        """Continuously monitor memory usage"""
        while True:
            try:
                # Host Memory Check
                host_memory = self._get_host_memory_stats()

                # Container Memory Check
                container_stats = self._get_container_memory_stats()

                # Construct comprehensive memory report
                report = {
                    "timestamp": datetime.now().isoformat(),
                    "host_percent": host_memory["percent"],
                    "host_available": host_memory["available"],
                    "container_stats": container_stats,
                }

                # High Memory Alert and Mitigation
                if host_memory["percent"] > self.host_threshold or any(
                    stat["percent"] > self.container_threshold
                    for stat in container_stats
                ):
                    self._send_alert(
                        f"High Memory Alert: {json.dumps(report, indent=2)}"
                    )
                    self._mitigate_high_memory(report)

                # Log memory stats periodically
                self.logger.info(json.dumps(report, indent=2))

                # Wait for next check
                time.sleep(self.check_interval)

            except Exception as e:
                self.logger.error(f"Monitoring error: {e}")
                time.sleep(self.check_interval)

    @classmethod
    def run(cls):
        """Class method to start monitoring"""
        monitor = cls()
        monitor.monitor()


if __name__ == "__main__":
    MemoryMonitor.run()
