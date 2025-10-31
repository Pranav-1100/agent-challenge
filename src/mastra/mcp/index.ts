import { MCPServer } from "@mastra/mcp";
import { 
  portfolioManagerTool,
  stockAnalyzerTool,
  smartStockResearchTool,
  smartAlertsTool,
  expenseTrackerTool,
  csvImporterTool,
  rebalancingAnalyzerTool,
  benchmarkComparisonTool,
  portfolioAdvisorTool,
  alertCheckerTool,
} from "../tools";
import { financeAgent } from "../agents";

export const server = new MCPServer({
  name: "FinanceAI Server",
  version: "2.0.0",
  tools: { 
    portfolioManagerTool,
    stockAnalyzerTool,
    smartStockResearchTool,
    smartAlertsTool,
    expenseTrackerTool,
    csvImporterTool,
    rebalancingAnalyzerTool,
    benchmarkComparisonTool,
    portfolioAdvisorTool,
    alertCheckerTool,
  },
  agents: { financeAgent },
});