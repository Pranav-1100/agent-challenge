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
  ipoResearchTool,
  portfolioProfitCalculatorTool,
  emailNotificationTool,
} from "../tools";
import { financeAgent } from "../agents";

export const server = new MCPServer({
  name: "FinanceAI Server",
  version: "2.2.0",
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
    ipoResearchTool,
    portfolioProfitCalculatorTool,
    emailNotificationTool,
  },
  agents: { financeAgent },
});