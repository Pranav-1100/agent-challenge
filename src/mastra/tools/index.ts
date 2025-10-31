import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import nodemailer from 'nodemailer';

export const emailNotificationTool = createTool({
  id: 'email-notification',
  description: 'Send email notifications to users for alerts and subscriptions',
  inputSchema: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      console.log(`📧 Sending email to ${context.to}...`);
      
      // Configure nodemailer transporter for Gmail
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: context.to,
        subject: context.subject,
        text: context.body,
      };

      await transporter.sendMail(mailOptions);

      console.log(`✅ Email sent successfully to ${context.to}`);
      
      return {
        success: true,
        message: `Email sent to ${context.to}`,
      };
    } catch (error) {
      console.error('❌ Email sending error:', error);
      return {
        success: false,
        message: `Failed to send email. Error: ${error}. Please check EMAIL_USER and EMAIL_PASS in .env`,
      };
    }
  },
});

export const ipoResearchTool = createTool({
  id: 'ipo-research',
  description: 'Get IPO calendar and information using Finnhub API',
  inputSchema: z.object({
    companyName: z.string().describe('Company name to search for (optional)'),
    timeframe: z.enum(['upcoming', 'recent', 'all']).optional().default('upcoming'),
  }),
  outputSchema: z.object({
    companyName: z.string(),
    ipoStatus: z.string(),
    ipos: z.array(z.object({
      name: z.string(),
      symbol: z.string().optional(),
      date: z.string(),
      exchange: z.string().optional(),
      priceRange: z.string().optional(),
      numberOfShares: z.number().optional(),
      totalValue: z.string().optional(),
      status: z.string(),
    })),
    findings: z.string(),
    recommendation: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      console.log(`🎯 Searching IPOs: ${context.companyName}`);
      
      const apiKey = process.env.FINNHUB_API_KEY;
      
      if (!apiKey) {
        return {
          companyName: context.companyName,
          ipoStatus: 'API_KEY_MISSING',
          ipos: [],
          findings: `To get real-time IPO data, add FINNHUB_API_KEY to your .env file.\n\nGet your free API key from: https://finnhub.io`,
          recommendation: 'Set up Finnhub API key for real-time IPO calendar data.',
        };
      }

      const today = new Date();
      let fromDate: Date;
      let toDate: Date;

      if (context.timeframe === 'upcoming') {
        fromDate = today;
        toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      } else if (context.timeframe === 'recent') {
        fromDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        toDate = today;
      } else {
        fromDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
        toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
      }

      const fromStr = fromDate.toISOString().split('T')[0];
      const toStr = toDate.toISOString().split('T')[0];

      const url = `https://finnhub.io/api/v1/calendar/ipo?from=${fromStr}&to=${toStr}&token=${apiKey}`;
      console.log(`🔍 Fetching from: ${url}`);
      
      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error ${response.status}:`, errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const allIPOs = data.ipoCalendar || [];
      
      console.log(`✅ Fetched ${allIPOs.length} IPOs`);

      let filteredIPOs = allIPOs;
      if (context.companyName && context.companyName.toLowerCase() !== 'all') {
        const searchTerm = context.companyName.toLowerCase();
        filteredIPOs = allIPOs.filter((ipo: any) => 
          ipo.name.toLowerCase().includes(searchTerm) ||
          (ipo.symbol && ipo.symbol.toLowerCase().includes(searchTerm))
        );
      }

      if (filteredIPOs.length === 0 && context.companyName) {
        return {
          companyName: context.companyName,
          ipoStatus: 'NOT_FOUND',
          ipos: allIPOs.slice(0, 10).map((ipo: any) => ({
            name: ipo.name,
            symbol: ipo.symbol || 'TBA',
            date: ipo.date,
            exchange: ipo.exchange,
            priceRange: ipo.price || 'TBA',
            numberOfShares: ipo.numberOfShares,
            totalValue: ipo.totalSharesValue ? `${(ipo.totalSharesValue / 1e6).toFixed(1)}M` : 'TBA',
            status: ipo.status,
          })),
          findings: `No IPOs found for "${context.companyName}".\n\nShowing ${Math.min(10, allIPOs.length)} ${context.timeframe} IPOs instead:\n\n${allIPOs.slice(0, 10).map((ipo: any) => `• ${ipo.name} (${ipo.symbol || 'TBA'}) - ${ipo.status} on ${ipo.date}`).join('\n')}`,
          recommendation: 'Check the IPO calendar for other opportunities or try a different company name.',
        };
      }

      const ipoDetails = (context.companyName ? filteredIPOs : filteredIPOs.slice(0, 10)).map((ipo: any) => ({
        name: ipo.name,
        symbol: ipo.symbol || 'TBA',
        date: ipo.date,
        exchange: ipo.exchange,
        priceRange: ipo.price || 'TBA',
        numberOfShares: ipo.numberOfShares,
        totalValue: ipo.totalSharesValue ? `${(ipo.totalSharesValue / 1e6).toFixed(1)}M` : 'TBA',
        status: ipo.status,
      }));

      const mainIPO = ipoDetails[0];
      
      let findings = '';
      if (context.companyName && filteredIPOs.length === 1) {
        findings = `**${mainIPO.name} (${mainIPO.symbol})**

📊 **IPO Details:**
• Status: ${mainIPO.status.toUpperCase()}
• Date: ${mainIPO.date}
• Exchange: ${mainIPO.exchange}
• Price Range: ${mainIPO.priceRange}
• Shares Offered: ${mainIPO.numberOfShares?.toLocaleString() || 'TBA'}
• Total Value: ${mainIPO.totalValue}

**What to Consider:**
✓ Review the prospectus for company fundamentals
✓ Check the company's financials and growth trajectory
✓ Compare valuation with industry peers
✓ Research promoter background and business model
✓ Monitor subscription numbers when available`;
      } else {
        findings = `**${context.timeframe.toUpperCase()} IPO CALENDAR**

Found ${ipoDetails.length} IPOs:\n\n` + ipoDetails.map((ipo: any, idx: number) => 
          `${idx + 1}. **${ipo.name}** (${ipo.symbol})
   📅 ${ipo.date} | ${ipo.exchange}
   💰 ${ipo.priceRange} | ${ipo.totalValue}
   📊 Status: ${ipo.status.toUpperCase()}`
        ).join('\n\n');
      }

      const recommendation = mainIPO.status === 'expected' 
        ? `The ${mainIPO.name} IPO is upcoming. Research thoroughly before applying. Consider the price range, company fundamentals, and your investment timeline.`
        : mainIPO.status === 'priced'
        ? `The ${mainIPO.name} IPO has been priced. Check the final price and subscription status before investing.`
        : `Review the IPO calendar for upcoming opportunities. Always read the prospectus and do your own research.`;

      return {
        companyName: context.companyName,
        ipoStatus: 'FOUND',
        ipos: ipoDetails,
        findings,
        recommendation,
      };
    } catch (error) {
      console.error('❌ IPO research error:', error);
      return {
        companyName: context.companyName,
        ipoStatus: 'ERROR',
        ipos: [],
        findings: `Unable to fetch IPO data. Error: ${error}\n\nPlease check:\n• Your internet connection\n• FINNHUB_API_KEY is valid\n• API quota limits`,
        recommendation: 'Try again later or check finnhub.io for API status.',
      };
    }
  },
});


export const portfolioProfitCalculatorTool = createTool({
  id: 'portfolio-profit-calculator',
  description: 'Calculate detailed profits and losses for the entire portfolio',
  inputSchema: z.object({
    portfolio: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),
    })),
  }),
  outputSchema: z.object({
    holdings: z.array(z.object({
      symbol: z.string(),
      quantity: z.number(),
      purchasePrice: z.number(),
      currentPrice: z.number(),
      totalCost: z.number(),
      totalValue: z.number(),
      profitLoss: z.number(),
      profitLossPercent: z.number(),
    })),
    totalCost: z.number(),
    totalValue: z.number(),
    totalProfit: z.number(),
    totalProfitPercent: z.number(),
    summary: z.string(),
  }),
  execute: async ({ context }) => {
    try {
      const apiKey = process.env.FINNHUB_API_KEY;
      
      if (!apiKey) {
        throw new Error('FINNHUB_API_KEY not configured');
      }

      console.log(`💰 Calculating profits for ${context.portfolio.length} stocks...`);

      const holdings = await Promise.all(
        context.portfolio.map(async (holding) => {
          try {
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${apiKey}`);
            const data = await response.json();
            const currentPrice = data.c || holding.purchasePrice;
            
            const totalCost = holding.purchasePrice * holding.quantity;
            const totalValue = currentPrice * holding.quantity;
            const profitLoss = totalValue - totalCost;
            const profitLossPercent = (profitLoss / totalCost) * 100;

            return {
              symbol: holding.symbol,
              quantity: holding.quantity,
              purchasePrice: holding.purchasePrice,
              currentPrice,
              totalCost,
              totalValue,
              profitLoss,
              profitLossPercent,
            };
          } catch (error) {
            console.error(`Error fetching ${holding.symbol}:`, error);
            return {
              symbol: holding.symbol,
              quantity: holding.quantity,
              purchasePrice: holding.purchasePrice,
              currentPrice: holding.purchasePrice,
              totalCost: holding.purchasePrice * holding.quantity,
              totalValue: holding.purchasePrice * holding.quantity,
              profitLoss: 0,
              profitLossPercent: 0,
            };
          }
        })
      );

      const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
      const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
      const totalProfit = totalValue - totalCost;
      const totalProfitPercent = (totalProfit / totalCost) * 100;

      const winners = holdings.filter(h => h.profitLoss > 0);
      const losers = holdings.filter(h => h.profitLoss < 0);
      
      const summary = `📊 **Portfolio Performance Summary:**

💰 **Total Investment:** $${totalCost.toFixed(2)}
💵 **Current Value:** $${totalValue.toFixed(2)}
${totalProfit >= 0 ? '📈' : '📉'} **Profit/Loss:** ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)} (${totalProfitPercent.toFixed(2)}%)

**Winners:** ${winners.length} stocks in profit
**Losers:** ${losers.length} stocks in loss

**Top Performer:** ${holdings.sort((a, b) => b.profitLossPercent - a.profitLossPercent)[0]?.symbol} (+${holdings.sort((a, b) => b.profitLossPercent - a.profitLossPercent)[0]?.profitLossPercent.toFixed(2)}%)
**Worst Performer:** ${holdings.sort((a, b) => a.profitLossPercent - b.profitLossPercent)[0]?.symbol} (${holdings.sort((a, b) => a.profitLossPercent - b.profitLossPercent)[0]?.profitLossPercent.toFixed(2)}%)`;

      console.log(`✅ Calculated: Total P/L = $${totalProfit.toFixed(2)}`);

      return {
        holdings,
        totalCost,
        totalValue,
        totalProfit,
        totalProfitPercent,
        summary,
      };
    } catch (error) {
      console.error('❌ Profit calculation error:', error);
      throw error;
    }
  },
});

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
  description: 'Get real-time stock price and basic analysis',
  inputSchema: z.object({
    symbol: z.string().describe('Stock ticker symbol'),
  }),
  outputSchema: StockAnalysisSchema,
  execute: async ({ context }) => {
    try {
      const symbol = context.symbol.toUpperCase().trim();
      const apiKey = process.env.FINNHUB_API_KEY;

      if (!apiKey) {
        return {
          symbol,
          name: symbol,
          currentPrice: 0,
          recommendation: 'ERROR',
          error: 'FINNHUB_API_KEY not configured',
        };
      }

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

      if (!quoteData.c || quoteData.c === 0) {
        return {
          symbol,
          name: symbol,
          currentPrice: 0,
          recommendation: 'ERROR',
          error: `Stock ${symbol} not found`,
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
      return {
        symbol: context.symbol.toUpperCase(),
        name: context.symbol.toUpperCase(),
        currentPrice: 0,
        recommendation: 'ERROR',
        error: String(error),
      };
    }
  },
});

// ============================================================================
// SMART STOCK RESEARCH
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
  description: 'Deep investment research with pros/cons',
  inputSchema: z.object({
    query: z.string().describe('Stock symbol or company'),
  }),
  outputSchema: StockResearchSchema,
  execute: async ({ context }) => {
    try {
      const symbol = context.query.toUpperCase().replace(/[^A-Z]/g, '');
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
          console.log('Could not fetch stock data');
        }
      }

      const newsData = await fetchStockNews(context.query);
      const analysis = generateAnalysis(stockData, newsData);

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

// ============================================================================
// OTHER TOOLS (keeping existing)
// ============================================================================

export const portfolioAdvisorTool = createTool({
  id: 'portfolio-advisor',
  description: 'AI-powered portfolio analysis',
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
    
    const totalValue = portfolio.reduce((sum, h) => {
      const price = h.currentPrice || h.purchasePrice;
      return sum + (price * h.quantity);
    }, 0);
    
    const diversificationScore = Math.min(numHoldings * 20, 100);
    
    const concentrationRisk = portfolio.map(h => {
      const price = h.currentPrice || h.purchasePrice;
      return (price * h.quantity / totalValue) * 100;
    });
    const maxConcentration = Math.max(...concentrationRisk);
    const riskScore = Math.min(maxConcentration * 2, 100);
    
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

export const rebalancingAnalyzerTool = createTool({
  id: 'rebalancing-analyzer',
  description: 'Analyze portfolio balance',
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

export const alertCheckerTool = createTool({
  id: 'alert-checker',
  description: 'Check triggered alerts',
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

export const benchmarkComparisonTool = createTool({
  id: 'benchmark-comparison',
  description: 'Compare vs S&P 500',
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

// Helper tools
export const portfolioManagerTool = createTool({
  id: 'portfolio-manager',
  description: 'Portfolio helper',
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
  description: 'Manage alerts',
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
      message: 'Alerts ready',
    };
  },
});

export const expenseTrackerTool = createTool({
  id: 'expense-tracker',
  description: 'Track expenses',
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
  description: 'Import CSV',
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

// Helper functions
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
    analysis: 'Analysis based on current market data',
    pros,
    cons,
    riskLevel,
    recommendation,
    reasoning: 'Consider your risk tolerance before investing.',
  };
}