import { Logger } from "tslog";

const LOG_LEVELS = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
} as const;

const minLevel =
  (process.env.LOG_LEVEL?.toLocaleLowerCase() as
    | keyof typeof LOG_LEVELS
    | undefined) || "info";

const logger = new Logger({
  name: "app",
  minLevel: LOG_LEVELS[minLevel],
});

if (process.env.NODE_ENV === "production") {
  logger.settings.hideLogPositionForProduction = true;
  logger.settings.type = "json";
}

export { logger };
