import pino from "pino";

// Create a logger instance
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

// Export the same methods that trigger.dev logger uses
export default {
  debug: (message: string, data?: Record<string, any>) =>
    logger.debug(data || {}, message),
  info: (message: string, data?: Record<string, any>) =>
    logger.info(data || {}, message),
  warn: (message: string, data?: Record<string, any>) =>
    logger.warn(data || {}, message),
  error: (message: string, data?: Record<string, any>) =>
    logger.error(data || {}, message),
};
