import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { financeAgent } from "./agents";
import { ConsoleLogger, LogLevel } from "@mastra/core/logger";
import { server } from "./mcp";

const LOG_LEVEL = process.env.LOG_LEVEL as LogLevel || "info";

export const mastra = new Mastra({
  agents: {
    financeAgent
  },
  mcpServers: {
    server
  },
  storage: new LibSQLStore({
    url: "file:finance.db" 
  }),
  logger: new ConsoleLogger({
    level: LOG_LEVEL,
  }),
});