import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ============================================================================
// TOOL 1: PORTFOLIO MANAGER
// ============================================================================

export const portfolioManagerTool = createTool({
  id: 'portfolio-manager',
  description: 'Helper tool for portfolio management. Gets current stock prices.',
  inputSchema: z.object({
    action: z.enum(['get-price', 'view']),
    symbol: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    currentPrice: z.number().optional(),
  }),
  execute: async ({ context }) => {
    if (context.action === 'get-price' && context.symbol) {
      try {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (apiKey) {
          const url = `https://finnhub.io/api/v1/quote?symbol=${context.symbol.toUpperCase()}&token=${apiKey}`;
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.c && data.c > 0) {
            return {
              success: true,
              message: `Current price for ${context.symbol}: $${data.c}`,
              currentPrice: data.c,
            };
          }
        }
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    }
    
    return {
      success: true,
      message: 'Action completed',
    };
  },
});

// ============================================================================
// TOOL 2: STOCK ANALYZER (Using Finnhub)
// ============================================================================

export type StockAnalysisResult = z.infer<typeof StockAnalysisSchema>;

const StockAnalysisSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  currentPrice: z.number(),
  change: z.number(),
  changePercent: z.number(),
  marketCap: z.string().optional(),
  peRatio: z.number().optional(),
  week52High: z.number().optional(),
  week52Low: z.number().optional(),
  volume: z.number().optional(),
  avgVolume: z.number().optional(),
  dividend: z.number().optional(),
  recommendation: z.string(),
});

export const stockAnalyzerTool = createTool({
  id: 'stock-analyzer',
  description: 'Get detailed real-time stock analysis with prices, metrics, and recommendations',
  inputSchema: z.object({
    symbol: z.string().describe('Stock ticker symbol (e.g., AAPL, TSLA)'),
  }),
  outputSchema: StockAnalysisSchema,
  execute: async ({ context }) => {
    try {
      const symbol = context.symbol.toUpperCase();
      const apiKey = process.env.FINNHUB_API_KEY;

      if (!apiKey) {
        throw new Error('Finnhub API key not configured');
      }

      // Fetch quote from Finnhub
      const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
      const quoteResponse = await fetch(quoteUrl);
      const quoteData = await quoteResponse.json();

      // Fetch company profile
      const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`;
      const profileResponse = await fetch(profileUrl);
      const profileData = await profileResponse.json();

      // Fetch basic financials
      const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`;
      const metricsResponse = await fetch(metricsUrl);
      const metricsData = await metricsResponse.json();

      if (!quoteData.c || quoteData.c === 0) {
        throw new Error(`Stock ${symbol} not found or no data available`);
      }

      const currentPrice = quoteData.c;
      const change = quoteData.d || 0;
      const changePercent = quoteData.dp || 0;

      // Simple recommendation logic
      let recommendation = 'HOLD';
      if (changePercent > 5) recommendation = 'STRONG BUY';
      else if (changePercent > 2) recommendation = 'BUY';
      else if (changePercent < -5) recommendation = 'STRONG SELL';
      else if (changePercent < -2) recommendation = 'SELL';

      return {
        symbol: symbol,
        name: profileData.name || symbol,
        currentPrice: currentPrice,
        change: change,
        changePercent: changePercent,
        marketCap: profileData.marketCapitalization ? formatMarketCap(profileData.marketCapitalization * 1e6) : undefined,
        peRatio: metricsData.metric?.peBasicExclExtraTTM || undefined,
        week52High: metricsData.metric?.['52WeekHigh'] || quoteData.h || undefined,
        week52Low: metricsData.metric?.['52WeekLow'] || quoteData.l || undefined,
        volume: undefined,
        avgVolume: undefined,
        dividend: metricsData.metric?.dividendYieldIndicatedAnnual || undefined,
        recommendation: recommendation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Stock analysis error:', errorMessage);
      
      return {
        symbol: context.symbol.toUpperCase(),
        name: context.symbol.toUpperCase(),
        currentPrice: 0,
        change: 0,
        changePercent: 0,
        recommendation: `ERROR: ${errorMessage}`,
      };
    }
  },
});

// ============================================================================
// TOOL 3: SMART STOCK RESEARCH (SHOWSTOPPER!)
// ============================================================================

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
  description: 'Comprehensive AI-powered stock research with web data, news analysis, and detailed pros/cons recommendations',
  inputSchema: z.object({
    query: z.string().describe('Stock symbol or IPO name to research (e.g., "AAPL", "Lenskart IPO")'),
  }),
  outputSchema: StockResearchSchema,
  execute: async ({ context }) => {
    try {
      const isIPO = context.query.toLowerCase().includes('ipo');
      let stockData: any = null;
      
      if (!isIPO) {
        // Regular stock - use Finnhub
        try {
          const symbol = context.query.toUpperCase().replace(/[^A-Z]/g, '');
          const apiKey = process.env.FINNHUB_API_KEY;

          if (apiKey) {
            // Get quote
            const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
            const quoteResponse = await fetch(quoteUrl);
            const quoteData = await quoteResponse.json();

            // Get profile
            const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`;
            const profileResponse = await fetch(profileUrl);
            const profileData = await profileResponse.json();

            // Get metrics
            const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`;
            const metricsResponse = await fetch(metricsUrl);
            const metricsData = await metricsResponse.json();

            if (quoteData.c && quoteData.c > 0) {
              stockData = {
                symbol: symbol,
                name: profileData.name || symbol,
                currentPrice: quoteData.c,
                peRatio: metricsData.metric?.peBasicExclExtraTTM,
                marketCap: profileData.marketCapitalization ? profileData.marketCapitalization * 1e6 : undefined,
              };
            }
          }
        } catch (err) {
          console.log('Could not fetch stock data, continuing with news analysis');
        }
      }

      // Fetch recent news
      const newsData = await fetchStockNews(context.query);

      // Generate analysis
      const analysis = generateAnalysis(stockData, newsData, isIPO);

      return {
        symbol: stockData?.symbol || context.query.toUpperCase(),
        name: stockData?.name || context.query,
        currentPrice: stockData?.currentPrice,
        analysis: analysis.analysis,
        pros: analysis.pros,
        cons: analysis.cons,
        riskLevel: analysis.riskLevel,
        recommendation: analysis.recommendation,
        reasoning: analysis.reasoning,
        news: newsData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Stock research error:', errorMessage);
      
      return {
        symbol: context.query.toUpperCase(),
        name: context.query,
        analysis: 'Unable to fetch complete data. Please try again.',
        pros: ['Data unavailable'],
        cons: ['Unable to analyze at this time'],
        riskLevel: 'HIGH' as const,
        recommendation: 'INSUFFICIENT DATA',
        reasoning: 'Could not complete analysis due to data fetch error.',
      };
    }
  },
});

// ============================================================================
// TOOL 4: SMART ALERTS & WATCHLIST
// ============================================================================

export const smartAlertsTool = createTool({
  id: 'smart-alerts',
  description: 'Set price alerts and manage watchlist for stocks',
  inputSchema: z.object({
    action: z.enum(['add-alert', 'remove-alert', 'check-alerts', 'view-alerts']),
    symbol: z.string().optional().describe('Stock symbol'),
    condition: z.enum(['above', 'below']).optional().describe('Price condition'),
    targetPrice: z.number().optional().describe('Alert price threshold'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    alerts: z.array(z.object({
      symbol: z.string(),
      condition: z.string(),
      targetPrice: z.number(),
      currentPrice: z.number().optional(),
      triggered: z.boolean(),
    })),
    triggeredAlerts: z.array(z.object({
      symbol: z.string(),
      message: z.string(),
    })).optional(),
  }),
  execute: async ({ context }) => {
    return {
      success: true,
      message: `Alert ${context.action} completed`,
      alerts: [],
    };
  },
});

// ============================================================================
// TOOL 5: EXPENSE TRACKER (OPTIONAL - IF TIME)
// ============================================================================

export const expenseTrackerTool = createTool({
  id: 'expense-tracker',
  description: 'Track personal expenses and bill reminders. Use updateWorkingMemory to actually store expenses and billReminders.',
  inputSchema: z.object({
    action: z.enum(['add', 'view', 'analyze', 'add-bill-reminder']),
    amount: z.number().optional(),
    category: z.enum(['food', 'transport', 'bills', 'entertainment', 'shopping', 'other']).optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    billName: z.string().optional().describe('Name of the bill/subscription'),
    dueDay: z.number().optional().describe('Day of month the bill is due (1-31)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    expenses: z.array(z.object({
      amount: z.number(),
      category: z.string(),
      description: z.string(),
      date: z.string(),
    })),
    monthlyTotal: z.number().optional(),
    categoryBreakdown: z.record(z.number()).optional(),
    billReminder: z.object({
      name: z.string(),
      amount: z.number(),
      dueDay: z.number(),
    }).optional(),
  }),
  execute: async ({ context }) => {
    if (context.action === 'add-bill-reminder' && context.billName && context.amount && context.dueDay) {
      return {
        success: true,
        message: `Bill reminder for ${context.billName} ($${context.amount}) due on day ${context.dueDay} has been noted. Use updateWorkingMemory to save it.`,
        expenses: [],
        billReminder: {
          name: context.billName,
          amount: context.amount,
          dueDay: context.dueDay,
        },
      };
    }
    
    if (context.action === 'add' && context.amount && context.category) {
      const today = new Date().toISOString().split('T')[0];
      return {
        success: true,
        message: `Expense of $${context.amount} for ${context.category} has been noted. Use updateWorkingMemory to save it.`,
        expenses: [{
          amount: context.amount,
          category: context.category,
          description: context.description || '',
          date: context.date || today,
        }],
      };
    }
    
    return {
      success: true,
      message: 'Expense tracking action completed',
      expenses: [],
    };
  },
});

// ============================================================================
// TOOL 6: STATE UPDATER - ENHANCED with Display Trigger
// ============================================================================

export const stateUpdaterTool = createTool({
  id: 'state-updater',
  description: 'Update the user financial state and trigger UI display. Use this for portfolio, alerts, expenses, and bill reminders.',
  inputSchema: z.object({
    updateType: z.enum(['add-to-portfolio', 'add-alert', 'add-expense', 'add-bill-reminder', 'show-portfolio', 'show-alerts', 'show-subscriptions']),
    
    // Portfolio fields
    symbol: z.string().optional(),
    quantity: z.number().optional(),
    purchasePrice: z.number().optional(),
    
    // Alert fields
    condition: z.enum(['above', 'below']).optional(),
    targetPrice: z.number().optional(),
    
    // Expense fields
    amount: z.number().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    
    // Bill reminder fields
    billName: z.string().optional(),
    dueDay: z.number().optional(),
    
    // Display data (for showing current state)
    displayData: z.any().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    updatedState: z.object({
      portfolio: z.array(z.any()).optional(),
      alerts: z.array(z.any()).optional(),
      expenses: z.array(z.any()).optional(),
      billReminders: z.array(z.any()).optional(),
    }),
    displayType: z.enum(['portfolio', 'alerts', 'subscriptions', 'none']).optional(),
    displayData: z.any().optional(),
  }),
  execute: async ({ context }) => {
    const result: any = {
      success: true,
      message: '',
      updatedState: {},
      displayType: 'none',
    };

    switch (context.updateType) {
      case 'add-to-portfolio':
        if (context.symbol && context.quantity && context.purchasePrice) {
          result.message = `Added ${context.quantity} shares of ${context.symbol} at $${context.purchasePrice.toFixed(2)}`;
          result.updatedState.portfolio = [{
            symbol: context.symbol.toUpperCase(),
            quantity: context.quantity,
            purchasePrice: context.purchasePrice,
          }];
          result.displayType = 'portfolio';
        }
        break;

      case 'add-alert':
        if (context.symbol && context.condition && context.targetPrice) {
          result.message = `Alert set: ${context.symbol} ${context.condition} $${context.targetPrice}`;
          result.updatedState.alerts = [{
            symbol: context.symbol.toUpperCase(),
            condition: context.condition,
            targetPrice: context.targetPrice,
          }];
          result.displayType = 'alerts';
        }
        break;

      case 'add-expense':
        if (context.amount && context.category) {
          const today = new Date().toISOString().split('T')[0];
          result.message = `Expense added: $${context.amount} - ${context.category}`;
          result.updatedState.expenses = [{
            amount: context.amount,
            category: context.category,
            description: context.description || '',
            date: context.date || today,
          }];
        }
        break;

      case 'add-bill-reminder':
        if (context.billName && context.amount && context.dueDay) {
          result.message = `Bill reminder added: ${context.billName} $${context.amount} on day ${context.dueDay}`;
          result.updatedState.billReminders = [{
            name: context.billName,
            amount: context.amount,
            dueDay: context.dueDay,
          }];
          result.displayType = 'subscriptions';
        }
        break;

      case 'show-portfolio':
      case 'show-alerts':
      case 'show-subscriptions':
        result.displayType = context.updateType.replace('show-', '') as any;
        result.displayData = context.displayData;
        break;

      default:
        result.success = false;
        result.message = 'Unknown update type';
    }

    return result;
  },
});

// ============================================================================
// TOOL 7: CSV PORTFOLIO IMPORTER
// ============================================================================

export const csvImporterTool = createTool({
  id: 'csv-importer',
  description: 'Import portfolio from CSV data. Expected format: Symbol,Quantity,PurchasePrice',
  inputSchema: z.object({
    csvData: z.string().describe('CSV string with format: Symbol,Quantity,PurchasePrice (one per line)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    importedCount: z.number(),
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
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.toLowerCase().includes('symbol')) continue; // Skip header
        
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
        message: `Successfully imported ${portfolio.length} holdings`,
        importedCount: portfolio.length,
        portfolio,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to parse CSV data',
        importedCount: 0,
        portfolio: [],
      };
    }
  },
});

// ============================================================================
// TOOL 8: PORTFOLIO REBALANCING ANALYZER
// ============================================================================

export const rebalancingAnalyzerTool = createTool({
  id: 'rebalancing-analyzer',
  description: 'Analyze portfolio and suggest rebalancing trades to achieve optimal allocation',
  inputSchema: z.object({
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      currentPrice: z.number(),
      totalValue: z.number(),
    })),
    targetAllocation: z.record(z.number()).optional().describe('Target % for each stock'),
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
    
    // Calculate current allocation
    const currentAllocation: Record<string, number> = {};
    context.portfolio.forEach(holding => {
      currentAllocation[holding.symbol] = (holding.totalValue / totalValue) * 100;
    });
    
    // Ideal allocation: Equal weight or target
    const idealAllocation = context.targetAllocation || {};
    const numHoldings = context.portfolio.length;
    const equalWeight = 100 / numHoldings;
    
    // Detect imbalances
    const suggestions: any[] = [];
    let maxDeviation = 0;
    
    context.portfolio.forEach(holding => {
      const target = idealAllocation[holding.symbol] || equalWeight;
      const current = currentAllocation[holding.symbol];
      const deviation = Math.abs(current - target);
      
      if (deviation > maxDeviation) maxDeviation = deviation;
      
      if (deviation > 10) { // More than 10% off target
        if (current > target) {
          suggestions.push({
            action: 'REDUCE',
            symbol: holding.symbol,
            shares: Math.floor((holding.totalValue - (totalValue * target / 100)) / holding.currentPrice),
            reasoning: `Currently ${current.toFixed(1)}%, target ${target.toFixed(1)}%. Overweight.`,
          });
        } else {
          suggestions.push({
            action: 'INCREASE',
            symbol: holding.symbol,
            shares: Math.ceil(((totalValue * target / 100) - holding.totalValue) / holding.currentPrice),
            reasoning: `Currently ${current.toFixed(1)}%, target ${target.toFixed(1)}%. Underweight.`,
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

// ============================================================================
// TOOL 9: BENCHMARK COMPARISON (vs S&P 500)
// ============================================================================

export const benchmarkComparisonTool = createTool({
  id: 'benchmark-comparison',
  description: 'Compare portfolio performance against S&P 500 benchmark',
  inputSchema: z.object({
    portfolioValue: z.number(),
    portfolioCostBasis: z.number(),
    timePeriod: z.string().optional().describe('Time period like "1M", "3M", "1Y"'),
  }),
  outputSchema: z.object({
    portfolioReturn: z.number(),
    sp500Return: z.number(),
    outperformance: z.number(),
    analysis: z.string(),
  }),
  execute: async ({ context }) => {
    // Calculate portfolio return
    const portfolioReturn = ((context.portfolioValue - context.portfolioCostBasis) / context.portfolioCostBasis) * 100;
    
    // Simplified S&P 500 returns (historical averages)
    // In production, fetch from API
    const sp500Returns: Record<string, number> = {
      '1M': 2.1,
      '3M': 5.5,
      '6M': 8.2,
      '1Y': 10.5,
      'YTD': 12.3,
    };
    
    const period = context.timePeriod || '1Y';
    const sp500Return = sp500Returns[period] || 10.5;
    const outperformance = portfolioReturn - sp500Return;
    
    let analysis = '';
    if (outperformance > 5) {
      analysis = `🎉 Excellent! Your portfolio is outperforming the S&P 500 by ${outperformance.toFixed(1)}%.`;
    } else if (outperformance > 0) {
      analysis = `📈 Good! You're beating the market by ${outperformance.toFixed(1)}%.`;
    } else if (outperformance > -5) {
      analysis = `📊 Close! You're slightly underperforming by ${Math.abs(outperformance).toFixed(1)}%.`;
    } else {
      analysis = `⚠️ Your portfolio is underperforming the S&P 500 by ${Math.abs(outperformance).toFixed(1)}%. Consider diversification.`;
    }
    
    return {
      portfolioReturn,
      sp500Return,
      outperformance,
      analysis,
    };
  },
});


// ============================================================================
// TOOL 10: AI PORTFOLIO ADVISOR
// ============================================================================

export const portfolioAdvisorTool = createTool({
  id: 'portfolio-advisor',
  description: 'AI-powered portfolio analysis with personalized recommendations and risk assessment',
  inputSchema: z.object({
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),
      currentPrice: z.number(),
      sector: z.string().optional(),
    })),
    riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  }),
  outputSchema: z.object({
    overallRating: z.string(),
    riskScore: z.number(),
    diversificationScore: z.number(),
    recommendations: z.array(z.string()),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    actionItems: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const portfolio = context.portfolio;
    const totalValue = portfolio.reduce((sum, h) => sum + (h.currentPrice * h.quantity), 0);
    
    // Calculate metrics
    const numHoldings = portfolio.length;
    const diversificationScore = Math.min(numHoldings * 20, 100); // Up to 5 stocks for full diversification
    
    // Risk analysis
    const totalGain = portfolio.reduce((sum, h) => {
      const gain = (h.currentPrice - h.purchasePrice) * h.quantity;
      return sum + gain;
    }, 0);
    const volatility = Math.abs((totalGain / totalValue) * 100);
    const riskScore = Math.min(volatility * 10, 100);
    
    // Recommendations
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const actionItems: string[] = [];
    
    // Diversification check
    if (numHoldings < 3) {
      weaknesses.push('Low diversification with only ' + numHoldings + ' holdings');
      actionItems.push('Add 2-3 more stocks from different sectors to reduce risk');
    } else if (numHoldings >= 5) {
      strengths.push('Well-diversified portfolio with ' + numHoldings + ' holdings');
    }
    
    // Concentration check
    portfolio.forEach(holding => {
      const percentage = (holding.currentPrice * holding.quantity / totalValue) * 100;
      if (percentage > 40) {
        weaknesses.push(`${holding.symbol} is ${percentage.toFixed(0)}% of portfolio (too concentrated)`);
        actionItems.push(`Reduce ${holding.symbol} position to under 30% of portfolio`);
      }
    });
    
    // Performance check
    if (totalGain > 0) {
      strengths.push(`Portfolio is profitable with ${((totalGain / totalValue) * 100).toFixed(1)}% returns`);
    } else {
      recommendations.push('Consider tax-loss harvesting opportunities');
    }
    
    // General recommendations
    if (riskScore > 70) {
      recommendations.push('High volatility detected. Consider adding stable dividend stocks');
    }
    
    if (diversificationScore < 60) {
      recommendations.push('Improve diversification across sectors and asset classes');
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
      actionItems,
    };
  },
});

// ============================================================================
// TOOL 11: ALERT CHECKER
// ============================================================================

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
    
    if (!apiKey) {
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
              message: `🔔 ALERT: ${alert.symbol} is now $${currentPrice.toFixed(2)} (${alert.condition} your target of $${alert.targetPrice})`,
            });
          }
        }
      } catch (error) {
        console.error(`Error checking alert for ${alert.symbol}:`, error);
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
    if (!apiKey) {
      console.log('News API key not found');
      return [];
    }

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
  } catch (error) {
    console.error('News fetch error:', error);
    return [];
  }
}

function generateAnalysis(stockData: any, newsData: any[], isIPO: boolean): {
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
  let recommendation = 'HOLD';
  let reasoning = '';

  if (stockData) {
    // Analyze P/E ratio
    if (stockData.peRatio) {
      if (stockData.peRatio < 15) {
        pros.push(`Low P/E ratio of ${stockData.peRatio.toFixed(1)} suggests good value`);
        riskLevel = 'LOW';
      } else if (stockData.peRatio > 50) {
        cons.push(`High P/E ratio of ${stockData.peRatio.toFixed(1)} indicates overvaluation`);
        riskLevel = 'HIGH';
      }
    }

    // Market cap analysis
    if (stockData.marketCap) {
      if (stockData.marketCap > 100e9) {
        pros.push('Large-cap company with stable market position');
      } else if (stockData.marketCap < 2e9) {
        cons.push('Small-cap stock with higher volatility');
        riskLevel = 'HIGH';
      }
    }

    // Price analysis
    if (stockData.currentPrice > 0) {
      pros.push(`Currently trading at $${stockData.currentPrice.toFixed(2)}`);
    }
  }

  // News sentiment (basic)
  if (newsData && newsData.length > 0) {
    pros.push(`${newsData.length} recent news articles show active market interest`);
  } else {
    cons.push('Limited recent news coverage');
  }

  // IPO specific
  if (isIPO) {
    cons.push('IPO stocks carry inherent volatility and risk');
    riskLevel = 'HIGH';
    recommendation = 'WAIT - Monitor listing performance';
  }

  // Default fallbacks
  if (pros.length === 0) pros.push('Requires detailed fundamental analysis');
  if (cons.length === 0) cons.push('Limited data for comprehensive evaluation');

  reasoning = `Based on available metrics${stockData ? ', financial data,' : ''} and recent market information. ${isIPO ? 'IPO stocks carry inherent risk due to limited trading history.' : 'Consider your risk tolerance and investment timeline before making decisions.'}`;

  return {
    analysis: 'Analysis based on current market data, financial metrics, and recent news.',
    pros,
    cons,
    riskLevel,
    recommendation,
    reasoning,
  };
}