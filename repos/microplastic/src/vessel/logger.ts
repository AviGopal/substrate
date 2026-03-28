/**
 * Vessel Logger
 *
 * Scoped logger for vessels with level filtering.
 */

import type { VesselLogger, LogLevel } from "./types.ts";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Create a scoped logger for a vessel
 */
export function createVesselLogger(
  vesselId: string,
  minLevel: LogLevel = "info"
): VesselLogger {
  const minLevelNum = LOG_LEVELS[minLevel];

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= minLevelNum;
  };

  const formatMessage = (level: LogLevel, message: string): string => {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${vesselId}] ${message}`;
  };

  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog("debug")) {
        console.debug(formatMessage("debug", message), ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog("info")) {
        console.info(formatMessage("info", message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog("warn")) {
        console.warn(formatMessage("warn", message), ...args);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog("error")) {
        console.error(formatMessage("error", message), ...args);
      }
    },
  };
}
