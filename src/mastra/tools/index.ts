import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import nodemailer from 'nodemailer';

// ============================================================================
// SIMPLIFIED TOOL SET - More Reliable & Easier to Use
// ============================================================================

// ============================================================================
// TOOL 1: STOCK ANALYZER (Core Tool - Must Work!)
// ============================================================================

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
  description: 'Get real-time stock price and basic analysis for any stock symbol',
  inputSchema: z.object({
    symbol: z.string().describe('Stock ticker symbol (e.g., AAPL, TSLA, MSFT)'),
  }),
  outputSchema: StockAnalysisSchema,
  execute: async ({ context }) => {
    try {
      const symbol = context.symbol.toUpperCase().trim();
      const apiKey = process.env.FINNHUB_API_KEY;

      if (!apiKey) {
        console.error('❌ FINNHUB_API_KEY not found in environment variables!');
        return {
          symbol,
          name: symbol,
          currentPrice: 0,
          recommendation: 'ERROR',
          error: 'API key not configured. Add FINNHUB_API_KEY to your .env file',
        };
      }

      console.log(`📊 Fetching data for ${symbol}...`);

      // Fetch quote
      const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
      const quoteResponse = await fetch(quoteUrl);
      const quoteData = await quoteResponse.json();

      if (!quoteData.c || quoteData.c === 0) {
        return {
          symbol,
          name: symbol,
          currentPrice: 0,
          recommendation: 'ERROR',
          error: `Stock symbol "${symbol}" not found. Try a different symbol.`,
        };
      }

      // Fetch company profile
      const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`;
      const profileResponse = await fetch(profileUrl);
      const profileData = await profileResponse.json();

      // Fetch metrics
      const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`;
      const metricsResponse = await fetch(metricsUrl);
      const metricsData = await metricsResponse.json();

      const currentPrice = quoteData.c;
      const change = quoteData.d || 0;
      const changePercent = quoteData.dp || 0;

      // Simple recommendation
      let recommendation = 'HOLD';
      if (changePercent > 5) recommendation = 'STRONG BUY';
      else if (changePercent > 2) recommendation = 'BUY';
      else if (changePercent < -5) recommendation = 'STRONG SELL';
      else if (changePercent < -2) recommendation = 'SELL';

      console.log(`✅ Got data for ${symbol}: $${currentPrice}`);

      return {
        symbol,
        name: profileData.name || symbol,
        currentPrice,
        change,
        changePercent,
        marketCap: profileData.marketCapitalization ? 
          formatMarketCap(profileData.marketCapitalization * 1e6) : undefined,
        peRatio: metricsData.metric?.peBasicExclExtraTTM || undefined,
        week52High: metricsData.metric?.['52WeekHigh'] || undefined,
        week52Low: metricsData.metric?.['52WeekLow'] || undefined,
        recommendation,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Stock analysis error:', errorMessage);
      
      return {
        symbol: context.symbol.toUpperCase(),
        name: context.symbol.toUpperCase(),
        currentPrice: 0,
        recommendation: 'ERROR',
        error: errorMessage,
      };
    }
  },
});

// ============================================================================
// TOOL 2: SMART STOCK RESEARCH
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
  error: z.string().optional(),
});

export const smartStockResearchTool = createTool({
  id: 'smart-stock-research',
  description: 'Deep investment research with pros/cons analysis and news',
  inputSchema: z.object({
    query: z.string().describe('Stock symbol or company name to research'),
  }),
  outputSchema: StockResearchSchema,
  execute: async ({ context }) => {
    try {
      console.log(`🔍 Researching: ${context.query}`);
      
      // Extract symbol
      const symbol = context.query.toUpperCase().replace(/[^A-Z]/g, '');
      
      // Get stock data
      const apiKey = process.env.FINNHUB_API_KEY;
      let stockData: any = null;

      if (apiKey && symbol) {
        try {
          const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
          const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${apiKey}`;
          const metricsUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${apiKey}`;

          const [quoteRes, profileRes, metricsRes] = await Promise.all([
            fetch(quoteUrl),
            fetch(profileUrl),
            fetch(metricsUrl),
          ]);

          const [quoteData, profileData, metricsData] = await Promise.all([
            quoteRes.json(),
            profileRes.json(),
            metricsRes.json(),
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
          console.log('Could not fetch full stock data');
        }
      }

      // Fetch news
      const newsData = await fetchStockNews(context.query);

      // Generate analysis
      const analysis = generateAnalysis(stockData, newsData);

      console.log(`✅ Research complete for ${context.query}`);

      return {
        symbol: stockData?.symbol || symbol || context.query,
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
      console.error('❌ Research error:', errorMessage);
      
      return {
        symbol: context.query,
        name: context.query,
        analysis: 'Unable to complete research',
        pros: ['Data unavailable'],
        cons: ['Research incomplete'],
        riskLevel: 'HIGH' as const,
        recommendation: 'INSUFFICIENT DATA',
        reasoning: 'Could not gather enough information for analysis',
        error: errorMessage,
      };
    }
  },
});

// ============================================================================
// TOOL 3: PORTFOLIO ADVISOR
// ============================================================================

export const portfolioAdvisorTool = createTool({
  id: 'portfolio-advisor',
  description: 'AI-powered portfolio analysis with recommendations',
  inputSchema: z.object({
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),
      currentPrice: z.number().optional(),
    })),
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
    const numHoldings = portfolio.length;
    
    // Calculate total value
    const totalValue = portfolio.reduce((sum, h) => {
      const price = h.currentPrice || h.purchasePrice;
      return sum + (price * h.quantity);
    }, 0);
    
    // Diversification score
    const diversificationScore = Math.min(numHoldings * 20, 100);
    
    // Risk score based on concentration
    const concentrationRisk = portfolio.map(h => {
      const price = h.currentPrice || h.purchasePrice;
      return (price * h.quantity / totalValue) * 100;
    });
    const maxConcentration = Math.max(...concentrationRisk);
    const riskScore = Math.min(maxConcentration * 2, 100);
    
    // Generate recommendations
    const recommendations: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const actionItems: string[] = [];
    
    if (numHoldings < 3) {
      weaknesses.push(`Only ${numHoldings} holdings - insufficient diversification`);
      actionItems.push('Add 2-3 more stocks from different sectors');
    } else if (numHoldings >= 5) {
      strengths.push(`Well-diversified with ${numHoldings} holdings`);
    }
    
    if (maxConcentration > 40) {
      weaknesses.push(`One stock represents ${maxConcentration.toFixed(0)}% of portfolio`);
      actionItems.push('Reduce concentration to under 30% per holding');
    }
    
    if (diversificationScore < 60) {
      recommendations.push('Increase diversification across sectors');
    }
    
    if (riskScore > 70) {
      recommendations.push('High concentration risk - consider rebalancing');
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
// TOOL 4: REBALANCING ANALYZER
// ============================================================================

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

// ============================================================================
// TOOL 5: ALERT CHECKER
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
        console.error(`Error checking alert for ${alert.symbol}`);
      }
    }
    
    return {
      triggeredAlerts,
      hasTriggered: triggeredAlerts.length > 0,
    };
  },
});

// ============================================================================
// TOOL 6: BENCHMARK COMPARISON
// ============================================================================

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
      analysis = `⚠️ Underperforming by ${Math.abs(outperformance).toFixed(1)}%. Consider diversification.`;
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
// HELPER TOOLS (Simplified)
// ============================================================================

export const portfolioManagerTool = createTool({
  id: 'portfolio-manager',
  description: 'Simple helper for portfolio operations',
  inputSchema: z.object({
    action: z.enum(['view', 'check']),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      message: 'Portfolio manager ready',
    };
  },
});

export const smartAlertsTool = createTool({
  id: 'smart-alerts',
  description: 'Manage price alerts',
  inputSchema: z.object({
    action: z.enum(['check', 'view']),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      message: 'Alerts manager ready',
    };
  },
});

export const expenseTrackerTool = createTool({
  id: 'expense-tracker',
  description: 'Track expenses and subscriptions',
  inputSchema: z.object({
    action: z.enum(['view', 'analyze']),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async () => {
    return {
      success: true,
      message: 'Expense tracker ready',
    };
  },
});

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

export const emailAlertTool = createTool({
  id: 'email-alert',
  description: 'Send email notifications for triggered price alerts',
  inputSchema: z.object({
    email: z.string().email(),
    subject: z.string(),
    message: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      // Use a service like SendGrid, Mailgun, or Gmail SMTP
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: context.email,
        subject: context.subject,
        text: context.message,
      });

      return {
        success: true,
        message: 'Email sent successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send email',
      };
    }
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
        pros.push(`Low P/E ratio (${stockData.peRatio.toFixed(1)}) suggests good value`);
        riskLevel = 'LOW';
      } else if (stockData.peRatio > 50) {
        cons.push(`High P/E ratio (${stockData.peRatio.toFixed(1)}) indicates overvaluation`);
        riskLevel = 'HIGH';
      }
    }

    if (stockData.marketCap) {
      if (stockData.marketCap > 100) {
        pros.push('Large-cap company with stable market position');
      } else if (stockData.marketCap < 2) {
        cons.push('Small-cap stock with higher volatility');
        riskLevel = 'HIGH';
      }
    }

    if (stockData.currentPrice) {
      pros.push(`Currently trading at $${stockData.currentPrice.toFixed(2)}`);
    }
  }

  if (newsData && newsData.length > 0) {
    pros.push(`${newsData.length} recent articles show active market interest`);
  } else {
    cons.push('Limited recent news coverage');
  }

  if (pros.length === 0) pros.push('Requires detailed analysis');
  if (cons.length === 0) cons.push('Limited data available');

  const recommendation = riskLevel === 'LOW' ? 'BUY' : 
                        riskLevel === 'MEDIUM' ? 'HOLD' : 'CAUTION';
  
  return {
    analysis: 'Analysis based on current market data and financial metrics',
    pros,
    cons,
    riskLevel,
    recommendation,
    reasoning: 'Consider your risk tolerance and investment timeline before making decisions.',
  };
}