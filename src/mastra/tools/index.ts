import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ============================================================================
// CORE TOOLS - Used by Agent (8 tools)
// ============================================================================

// 1. ADD STOCK TOOL (Core - Updates Memory)
export const addStockTool = createTool({
  id: 'add-stock',
  description: 'Add stock to portfolio with proper memory management',
  inputSchema: z.object({
    symbol: z.string().describe('Stock ticker symbol'),
    quantity: z.number().describe('Number of shares'),
    price: z.number().describe('Purchase price per share'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.memory) {
      return {
        success: false,
        message: 'Memory not available'
      };
    }

    const { symbol, quantity, price } = context;
    const symbolUpper = symbol.toUpperCase();
    
    const memory = await mastra.memory.getWorkingMemory(context.runId!);
    const portfolio = (memory?.portfolio as any[]) || [];
    
    const existingIndex = portfolio.findIndex((h: any) => h.symbol === symbolUpper);
    
    let updatedPortfolio;
    if (existingIndex >= 0) {
      updatedPortfolio = [...portfolio];
      const existing = updatedPortfolio[existingIndex];
      
      updatedPortfolio[existingIndex] = {
        symbol: symbolUpper,
        quantity: existing.quantity + quantity,
        purchasePrice: existing.purchasePrice,
        purchases: [
          ...(existing.purchases || [{ quantity: existing.quantity, price: existing.purchasePrice }]),
          { quantity, price }
        ]
      };
    } else {
      updatedPortfolio = [
        ...portfolio,
        {
          symbol: symbolUpper,
          quantity,
          purchasePrice: price,
          purchases: [{ quantity, price }]
        }
      ];
    }
    
    await mastra.memory.updateWorkingMemory(context.runId!, {
      portfolio: updatedPortfolio
    });
    
    return {
      success: true,
      message: `✅ Added ${quantity} shares of ${symbolUpper} at $${price.toFixed(2)}`
    };
  },
});

// 2. REMOVE STOCK TOOL (Core - Updates Memory)
export const removeStockTool = createTool({
  id: 'remove-stock',
  description: 'Remove stock from portfolio',
  inputSchema: z.object({
    symbol: z.string(),
    quantity: z.number().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.memory) {
      return {
        success: false,
        message: 'Memory not available'
      };
    }

    const { symbol, quantity } = context;
    const symbolUpper = symbol.toUpperCase();
    
    const memory = await mastra.memory.getWorkingMemory(context.runId!);
    const portfolio = (memory?.portfolio as any[]) || [];
    
    const existingIndex = portfolio.findIndex((h: any) => h.symbol === symbolUpper);
    
    if (existingIndex < 0) {
      return { success: false, message: `${symbolUpper} not found in portfolio` };
    }
    
    let updatedPortfolio;
    if (!quantity || portfolio[existingIndex].quantity <= quantity) {
      updatedPortfolio = portfolio.filter((h: any) => h.symbol !== symbolUpper);
    } else {
      updatedPortfolio = [...portfolio];
      updatedPortfolio[existingIndex] = {
        ...updatedPortfolio[existingIndex],
        quantity: updatedPortfolio[existingIndex].quantity - quantity,
      };
    }
    
    await mastra.memory.updateWorkingMemory(context.runId!, {
      portfolio: updatedPortfolio
    });
    
    return {
      success: true,
      message: `✅ Removed ${quantity || 'all'} shares of ${symbolUpper}`
    };
  },
});

// 3. STOCK ANALYZER TOOL (Core - Price & Metrics)
export type StockAnalysisResult = z.infer<typeof StockAnalysisSchema>;

const StockAnalysisSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  currentPrice: z.number(),
  change: z.number().optional(),
  changePercent: z.number().optional(),
  marketCap: z.string().optional(),
  peRatio: z.number().optional(),
  week52High: z.number().optional(),
  week52Low: z.number().optional(),
  recommendation: z.string(),
  error: z.string().optional(),
});

export const stockAnalyzerTool = createTool({
  id: 'stock-analyzer',
  description: 'Get current stock price and metrics (use ONCE per stock)',
  inputSchema: z.object({
    symbol: z.string().describe('Stock ticker symbol (e.g., AAPL, TSLA, MSFT)'),
  }),
  outputSchema: StockAnalysisSchema,
  execute: async ({ context }) => {
    try {
      const symbol = context.symbol.toUpperCase().trim();
      const apiKey = process.env.FINNHUB_API_KEY;

      if (!apiKey) {
        return {
          symbol, name: symbol, currentPrice: 0,
          recommendation: 'ERROR',
          error: 'FINNHUB_API_KEY not configured'
        };
      }

      const [quoteRes, profileRes, metricsRes] = await Promise.all([
        fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`),
      ]);

      const [quoteData, profileData, metricsData] = await Promise.all([
        quoteRes.json(), profileRes.json(), metricsRes.json()
      ]);

      if (!quoteData.c || quoteData.c === 0) {
        return {
          symbol, name: symbol, currentPrice: 0,
          recommendation: 'ERROR',
          error: `Symbol "${symbol}" not found`
        };
      }

      const currentPrice = quoteData.c;
      const change = quoteData.d || 0;
      const changePercent = quoteData.dp || 0;

      let recommendation = 'HOLD';
      if (changePercent > 5) recommendation = 'STRONG BUY';
      else if (changePercent > 2) recommendation = 'BUY';
      else if (changePercent < -5) recommendation = 'STRONG SELL';
      else if (changePercent < -2) recommendation = 'SELL';

      return {
        symbol,
        name: profileData.name || symbol,
        currentPrice, change, changePercent,
        marketCap: profileData.marketCapitalization ? 
          formatMarketCap(profileData.marketCapitalization * 1e6) : undefined,
        peRatio: metricsData.metric?.peBasicExclExtraTTM || undefined,
        week52High: metricsData.metric?.['52WeekHigh'] || undefined,
        week52Low: metricsData.metric?.['52WeekLow'] || undefined,
        recommendation,
      };
    } catch (error) {
      return {
        symbol: context.symbol.toUpperCase(),
        name: context.symbol.toUpperCase(),
        currentPrice: 0,
        recommendation: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
});

// 4. SMART STOCK RESEARCH TOOL (Core - Deep Analysis)
export type StockResearchResult = z.infer<typeof StockResearchSchema>;

const StockResearchSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  currentPrice: z.number().optional(),
  analysis: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY HIGH']),
  recommendation: z.string(),
  reasoning: z.string(),
  news: z.array(z.object({
    title: z.string(),
    summary: z.string().optional(),
    source: z.string(),
    publishedAt: z.string(),
  })).optional(),
});

export const smartStockResearchTool = createTool({
  id: 'smart-stock-research',
  description: 'Deep research with pros/cons (use ONCE per query)',
  inputSchema: z.object({
    query: z.string().describe('Stock symbol or company name to research'),
  }),
  outputSchema: StockResearchSchema,
  execute: async ({ context }) => {
    try {
      const symbol = context.query.toUpperCase().replace(/[^A-Z]/g, '');
      const apiKey = process.env.FINNHUB_API_KEY;
      
      let stockData: any = null;

      if (apiKey && symbol) {
        try {
          const [quoteRes, profileRes, metricsRes] = await Promise.all([
            fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`),
            fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`),
            fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`),
          ]);

          const [quoteData, profileData, metricsData] = await Promise.all([
            quoteRes.json(), profileRes.json(), metricsRes.json()
          ]);

          if (quoteData.c && quoteData.c > 0) {
            stockData = {
              symbol,
              name: profileData.name || symbol,
              currentPrice: quoteData.c,
              peRatio: metricsData.metric?.peBasicExclExtraTTM,
              marketCap: profileData.marketCapitalization,
            };
          }
        } catch (err) {
          console.log('Could not fetch stock data');
        }
      }

      const newsData = await fetchStockNews(context.query);
      const analysis = generateAnalysis(stockData, newsData);

      return {
        symbol: stockData?.symbol || symbol || context.query,
        name: stockData?.name || context.query,
        currentPrice: stockData?.currentPrice,
        ...analysis,
        news: newsData,
      };
    } catch (error) {
      return {
        symbol: context.query,
        name: context.query,
        analysis: 'Unable to complete research',
        pros: ['Data unavailable'],
        cons: ['Research incomplete'],
        riskLevel: 'HIGH' as const,
        recommendation: 'INSUFFICIENT DATA',
        reasoning: 'Could not gather information',
      };
    }
  },
});

// 5. PORTFOLIO ADVISOR TOOL (Core - Complete Portfolio Analysis)
export const portfolioAdvisorTool = createTool({
  id: 'portfolio-advisor',
  description: 'Analyze ENTIRE portfolio with current prices (use ONCE)',
  inputSchema: z.object({
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),
      purchases: z.array(z.object({
        quantity: z.number(),
        price: z.number(),
      })).optional(),
    })),
  }),
  outputSchema: z.object({
    overallRating: z.string(),
    riskScore: z.number(),
    diversificationScore: z.number(),
    recommendations: z.array(z.string()),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    holdings: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      avgCost: z.number(),
      currentPrice: z.number(),
      totalValue: z.number(),
      gainLoss: z.number(),
      gainLossPercent: z.number(),
    })),
    totalValue: z.number(),
    totalCost: z.number(),
    totalGain: z.number(),
    totalGainPercent: z.number(),
  }),
  execute: async ({ context }) => {
    const portfolio = context.portfolio;
    const apiKey = process.env.FINNHUB_API_KEY;
    
    // Fetch ALL current prices in parallel
    const holdings = await Promise.all(
      portfolio.map(async (holding) => {
        let currentPrice = holding.purchasePrice;
        
        if (apiKey) {
          try {
            const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${apiKey}`);
            const data = await res.json();
            if (data.c && data.c > 0) currentPrice = data.c;
          } catch (err) {
            console.log(`Could not fetch ${holding.symbol}`);
          }
        }
        
        // Calculate average cost
        let avgCost = holding.purchasePrice;
        if (holding.purchases && holding.purchases.length > 0) {
          const totalCost = holding.purchases.reduce((sum, p) => sum + (p.price * p.quantity), 0);
          const totalQty = holding.purchases.reduce((sum, p) => sum + p.quantity, 0);
          avgCost = totalCost / totalQty;
        }
        
        const totalValue = currentPrice * holding.quantity;
        const totalCost = avgCost * holding.quantity;
        const gainLoss = totalValue - totalCost;
        const gainLossPercent = (gainLoss / totalCost) * 100;
        
        return {
          symbol: holding.symbol,
          quantity: holding.quantity,
          avgCost,
          currentPrice,
          totalValue,
          gainLoss,
          gainLossPercent,
        };
      })
    );
    
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.avgCost * h.quantity), 0);
    const totalGain = totalValue - totalCost;
    const totalGainPercent = (totalGain / totalCost) * 100;
    
    const numHoldings = holdings.length;
    const diversificationScore = Math.min(numHoldings * 20, 100);
    
    const concentrationRisk = holdings.map(h => (h.totalValue / totalValue) * 100);
    const maxConcentration = Math.max(...concentrationRisk);
    const riskScore = Math.min(maxConcentration * 2, 100);
    
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    if (numHoldings < 3) {
      weaknesses.push(`Only ${numHoldings} holdings - insufficient diversification`);
      recommendations.push('Add 2-3 more stocks from different sectors');
    } else if (numHoldings >= 5) {
      strengths.push(`Well-diversified with ${numHoldings} holdings`);
    }
    
    if (maxConcentration > 40) {
      weaknesses.push(`One stock represents ${maxConcentration.toFixed(0)}% of portfolio`);
      recommendations.push('Reduce concentration to under 30% per holding');
    }
    
    if (totalGainPercent > 10) {
      strengths.push(`Strong returns: +${totalGainPercent.toFixed(1)}%`);
    } else if (totalGainPercent < -5) {
      weaknesses.push(`Negative returns: ${totalGainPercent.toFixed(1)}%`);
      recommendations.push('Review underperforming holdings');
    }
    
    const overallRating = diversificationScore > 70 && riskScore < 50 ? 'EXCELLENT' :
                          diversificationScore > 50 && riskScore < 70 ? 'GOOD' :
                          'NEEDS IMPROVEMENT';
    
    return {
      overallRating,
      riskScore: Math.round(riskScore),
      diversificationScore: Math.round(diversificationScore),
      recommendations,
      strengths,
      weaknesses,
      holdings,
      totalValue,
      totalCost,
      totalGain,
      totalGainPercent,
    };
  },
});

// 6. ADD ALERT TOOL (Core - Updates Memory)
export const addAlertTool = createTool({
  id: 'add-alert',
  description: 'Add price alert',
  inputSchema: z.object({
    symbol: z.string(),
    condition: z.enum(['above', 'below']),
    targetPrice: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.memory) {
      return {
        success: false,
        message: 'Memory not available'
      };
    }

    const memory = await mastra.memory.getWorkingMemory(context.runId!);
    const alerts = (memory?.alerts as any[]) || [];
    
    const newAlert = {
      symbol: context.symbol.toUpperCase(),
      condition: context.condition,
      targetPrice: context.targetPrice,
    };
    
    await mastra.memory.updateWorkingMemory(context.runId!, {
      alerts: [...alerts, newAlert]
    });
    
    return {
      success: true,
      message: `✅ Alert set: ${newAlert.symbol} ${newAlert.condition} $${newAlert.targetPrice}`
    };
  },
});

// 7. ADD EXPENSE TOOL (Core - Updates Memory)
export const addExpenseTool = createTool({
  id: 'add-expense',
  description: 'Track expense',
  inputSchema: z.object({
    amount: z.number(),
    category: z.string(),
    description: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.memory) {
      return {
        success: false,
        message: 'Memory not available'
      };
    }

    const memory = await mastra.memory.getWorkingMemory(context.runId!);
    const expenses = (memory?.expenses as any[]) || [];
    
    const newExpense = {
      amount: context.amount,
      category: context.category,
      description: context.description,
      date: new Date().toISOString(),
    };
    
    await mastra.memory.updateWorkingMemory(context.runId!, {
      expenses: [...expenses, newExpense]
    });
    
    return {
      success: true,
      message: `✅ Tracked: $${context.amount} on ${context.category}`
    };
  },
});

// 8. ADD SUBSCRIPTION TOOL (Core - Updates Memory)
export const addSubscriptionTool = createTool({
  id: 'add-subscription',
  description: 'Add monthly subscription',
  inputSchema: z.object({
    name: z.string(),
    amount: z.number(),
    dueDay: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (!mastra?.memory) {
      return {
        success: false,
        message: 'Memory not available'
      };
    }

    const memory = await mastra.memory.getWorkingMemory(context.runId!);
    const bills = (memory?.billReminders as any[]) || [];
    
    const newBill = {
      name: context.name,
      amount: context.amount,
      dueDay: context.dueDay,
    };
    
    await mastra.memory.updateWorkingMemory(context.runId!, {
      billReminders: [...bills, newBill]
    });
    
    return {
      success: true,
      message: `✅ Added: ${context.name} - $${context.amount}/month`
    };
  },
});

// ============================================================================
// OPTIONAL TOOLS - Not in Agent, But Available (4 tools)
// ============================================================================

// 9. CSV IMPORTER (Optional - For Frontend Use)
export const csvImporterTool = createTool({
  id: 'csv-importer',
  description: 'Import portfolio from CSV',
  inputSchema: z.object({
    csvData: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),
    })),
  }),
  execute: async ({ context }) => {
    try {
      const lines = context.csvData.trim().split('\n');
      const portfolio: any[] = [];
      
      for (const line of lines) {
        if (!line.trim() || line.toLowerCase().includes('symbol')) continue;
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          const symbol = parts[0].toUpperCase();
          const quantity = parseFloat(parts[1]);
          const purchasePrice = parseFloat(parts[2]);
          
          if (symbol && !isNaN(quantity) && !isNaN(purchasePrice)) {
            portfolio.push({ symbol, quantity, purchasePrice });
          }
        }
      }
      
      return {
        success: true,
        message: `Imported ${portfolio.length} holdings`,
        portfolio,
      };
    } catch {
      return {
        success: false,
        message: 'Failed to parse CSV',
        portfolio: [],
      };
    }
  },
});

// 10. REBALANCING ANALYZER (Optional - Advanced Feature)
export const rebalancingAnalyzerTool = createTool({
  id: 'rebalancing-analyzer',
  description: 'Analyze portfolio balance and suggest rebalancing trades',
  inputSchema: z.object({
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      currentPrice: z.number(),
      totalValue: z.number(),
    })),
  }),
  outputSchema: z.object({
    isBalanced: z.boolean(),
    currentAllocation: z.record(z.number()),
    suggestions: z.array(z.object({
      action: z.string(),
      symbol: z.string(),
      shares: z.number(),
      reasoning: z.string(),
    })),
    totalValue: z.number(),
  }),
  execute: async ({ context }) => {
    const totalValue = context.portfolio.reduce((sum, h) => sum + h.totalValue, 0);
    
    const currentAllocation: Record<string, number> = {};
    context.portfolio.forEach(holding => {
      currentAllocation[holding.symbol] = (holding.totalValue / totalValue) * 100;
    });
    
    const equalWeight = 100 / context.portfolio.length;
    const suggestions: any[] = [];
    let maxDeviation = 0;
    
    context.portfolio.forEach(holding => {
      const current = currentAllocation[holding.symbol];
      const deviation = Math.abs(current - equalWeight);
      
      if (deviation > maxDeviation) maxDeviation = deviation;
      
      if (deviation > 10) {
        if (current > equalWeight) {
          suggestions.push({
            action: 'REDUCE',
            symbol: holding.symbol,
            shares: Math.floor((holding.totalValue - (totalValue * equalWeight / 100)) / holding.currentPrice),
            reasoning: `Currently ${current.toFixed(1)}%, target ${equalWeight.toFixed(1)}%`,
          });
        } else {
          suggestions.push({
            action: 'INCREASE',
            symbol: holding.symbol,
            shares: Math.ceil(((totalValue * equalWeight / 100) - holding.totalValue) / holding.currentPrice),
            reasoning: `Currently ${current.toFixed(1)}%, target ${equalWeight.toFixed(1)}%`,
          });
        }
      }
    });
    
    return {
      isBalanced: maxDeviation < 10,
      currentAllocation,
      suggestions,
      totalValue,
    };
  },
});

// 11. BENCHMARK COMPARISON (Optional - Advanced Feature)
export const benchmarkComparisonTool = createTool({
  id: 'benchmark-comparison',
  description: 'Compare portfolio performance vs S&P 500',
  inputSchema: z.object({
    portfolioValue: z.number(),
    portfolioCostBasis: z.number(),
    timePeriod: z.string().optional().default('1Y'),
  }),
  outputSchema: z.object({
    portfolioReturn: z.number(),
    sp500Return: z.number(),
    outperformance: z.number(),
    analysis: z.string(),
  }),
  execute: async ({ context }) => {
    const portfolioReturn = ((context.portfolioValue - context.portfolioCostBasis) / context.portfolioCostBasis) * 100;
    
    const sp500Returns: Record<string, number> = {
      '1M': 2.1,
      '3M': 5.5,
      '6M': 8.2,
      '1Y': 10.5,
      'YTD': 12.3,
    };
    
    const sp500Return = sp500Returns[context.timePeriod] || 10.5;
    const outperformance = portfolioReturn - sp500Return;
    
    let analysis = '';
    if (outperformance > 5) {
      analysis = `🎉 Excellent! Outperforming S&P 500 by ${outperformance.toFixed(1)}%`;
    } else if (outperformance > 0) {
      analysis = `📈 Good! Beating the market by ${outperformance.toFixed(1)}%`;
    } else {
      analysis = `⚠️ Underperforming by ${Math.abs(outperformance).toFixed(1)}%`;
    }
    
    return {
      portfolioReturn,
      sp500Return,
      outperformance,
      analysis,
    };
  },
});

// 12. ALERT CHECKER (Optional - For Background Jobs)
export const alertCheckerTool = createTool({
  id: 'alert-checker',
  description: 'Check if any price alerts have been triggered',
  inputSchema: z.object({
    alerts: z.array(z.object({
      symbol: z.string(),
      condition: z.enum(['above', 'below']),
      targetPrice: z.number(),
    })),
  }),
  outputSchema: z.object({
    triggeredAlerts: z.array(z.object({
      symbol: z.string(),
      currentPrice: z.number(),
      targetPrice: z.number(),
      condition: z.string(),
      message: z.string(),
    })),
    hasTriggered: z.boolean(),
  }),
  execute: async ({ context }) => {
    const apiKey = process.env.FINNHUB_API_KEY;
    const triggeredAlerts: any[] = [];
    
    if (!apiKey || context.alerts.length === 0) {
      return { triggeredAlerts: [], hasTriggered: false };
    }
    
    for (const alert of context.alerts) {
      try {
        const url = `https://finnhub.io/api/v1/quote?symbol=${alert.symbol}&token=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        const currentPrice = data.c || 0;
        
        if (currentPrice > 0) {
          const isTriggered = 
            (alert.condition === 'below' && currentPrice < alert.targetPrice) ||
            (alert.condition === 'above' && currentPrice > alert.targetPrice);
          
          if (isTriggered) {
            triggeredAlerts.push({
              symbol: alert.symbol,
              currentPrice,
              targetPrice: alert.targetPrice,
              condition: alert.condition,
              message: `🔔 ${alert.symbol} is now $${currentPrice.toFixed(2)} (${alert.condition} $${alert.targetPrice})`,
            });
          }
        }
      } catch (error) {
        console.error(`Error checking ${alert.symbol}`);
      }
    }
    
    return {
      triggeredAlerts,
      hasTriggered: triggeredAlerts.length > 0,
    };
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  return `$${cap.toFixed(2)}`;
}

async function fetchStockNews(query: string): Promise<any[]> {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return [];

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.articles) {
      return data.articles.map((article: any) => ({
        title: article.title,
        summary: article.description,
        source: article.source.name,
        publishedAt: article.publishedAt,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

function generateAnalysis(stockData: any, newsData: any[]): {
  analysis: string;
  pros: string[];
  cons: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH';
  recommendation: string;
  reasoning: string;
} {
  const pros: string[] = [];
  const cons: string[] = [];
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH' = 'MEDIUM';
  
  if (stockData) {
    if (stockData.peRatio) {
      if (stockData.peRatio < 15) {
        pros.push(`Low P/E ratio (${stockData.peRatio.toFixed(1)})`);
        riskLevel = 'LOW';
      } else if (stockData.peRatio > 50) {
        cons.push(`High P/E ratio (${stockData.peRatio.toFixed(1)})`);
        riskLevel = 'HIGH';
      }
    }

    if (stockData.marketCap) {
      if (stockData.marketCap > 100) {
        pros.push('Large-cap with stable position');
      } else if (stockData.marketCap < 2) {
        cons.push('Small-cap with higher volatility');
        riskLevel = 'HIGH';
      }
    }

    if (stockData.currentPrice) {
      pros.push(`Trading at $${stockData.currentPrice.toFixed(2)}`);
    }
  }

  if (newsData && newsData.length > 0) {
    pros.push(`${newsData.length} recent articles show market interest`);
  } else {
    cons.push('Limited recent news coverage');
  }

  if (pros.length === 0) pros.push('Requires detailed analysis');
  if (cons.length === 0) cons.push('Limited data available');

  const recommendation = riskLevel === 'LOW' ? 'BUY' : 
                        riskLevel === 'MEDIUM' ? 'HOLD' : 'CAUTION';
  
  return {
    analysis: 'Analysis based on current market data',
    pros,
    cons,
    riskLevel,
    recommendation,
    reasoning: 'This is not financial advice. Do your own research.',
  };
}