#!/usr/bin/env python3
"""
Reusable Metrics Fetching Template for Activity Visualizations

This template provides a standardized approach to fetching, validating, and
outputting metrics data for activity visualization tasks. It addresses common
validation failures by ensuring reliable data retrieval and validated output.

Usage:
    from templates.metrics_fetching_template import MetricsFetcher
    
    fetcher = MetricsFetcher(
        api_url="http://localhost:8081",
        api_key="your-api-key",
        output_dir="./output/visualization-name"
    )
    
    # Fetch and validate metrics
    result = await fetcher.fetch_and_validate(
        template_id="your-template-id",
        time_range_hours=24
    )
    
    # Generate visualization data
    viz_data = fetcher.prepare_visualization_data(result.metrics)
    
    # Save validated outputs
    fetcher.save_outputs(viz_data, "visualization-data.json")

Features:
- Robust error handling and retries
- Data validation with Pydantic models
- Standardized output format
- Comprehensive logging
- Fallback mechanisms for unreliable data sources
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, asdict

try:
    import aiohttp
except ImportError:
    print("ERROR: aiohttp not installed. Run: pip install aiohttp")
    raise

try:
    from pydantic import BaseModel, ValidationError, validator
except ImportError:
    print("WARNING: pydantic not installed. Using basic validation")
    
    class BaseModel:
        pass
    
    ValidationError = Exception
    
    def validator(*args, **kwargs):
        def decorator(func):
            return func
        return decorator