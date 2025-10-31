import { MCPServer } from "@mastra/mcp";
import { 
  // Core Tools (8) - Used by Agent
  addStockTool,
  removeStockTool,
  stockAnalyzerTool,
  smartStockResearchTool,
  portfolioAdvisorTool,
  addAlertTool,
  addExpenseTool,
  addSubscriptionTool,
  
  // Optional Tools (4) - Available but not in agent
  csvImporterTool,
  rebalancingAnalyzerTool,
  benchmarkComparisonTool,
  alertCheckerTool,
} from "../tools";
import { financeAgent } from "../agents";

export const server = new MCPServer({
  name: "FinanceAI Server",
  version: "3.0.0",
  
  // Expose ALL 12 tools via MCP
  // This allows external systems to use any tool
  tools: { 
    // Core Tools
    addStockTool,
    removeStockTool,
    stockAnalyzerTool,
    smartStockResearchTool,
    portfolioAdvisorTool,
    addAlertTool,
    addExpenseTool,
    addSubscriptionTool,
    
    // Optional Tools
    csvImporterTool,
    rebalancingAnalyzerTool,
    benchmarkComparisonTool,
    alertCheckerTool,
  },
  
  // Agent only has 8 core tools
  agents: { financeAgent },
});