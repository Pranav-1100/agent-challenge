"use client";

import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { useState, useEffect, useRef, useCallback } from "react";
import { FinanceAgentState } from "@/mastra/agents";
import { z } from "zod";
import { StockAnalysisResult, StockResearchResult } from "@/mastra/tools";

type AgentState = z.infer<typeof FinanceAgentState>;

export default function FinanceApp() {
  const [themeColor, setThemeColor] = useState("#10b981");

  useCopilotAction({
    name: "setThemeColor",
    parameters: [{
      name: "themeColor",
      description: "The theme color to set.",
      required: true,
    }],
    handler({ themeColor }) {
      setThemeColor(themeColor);
    },
  });

  return (
    <main style={{ "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties}>
      <MainDashboard themeColor={themeColor} />
      <CopilotSidebar
        clickOutsideToClose={false}
        defaultOpen={true}
        labels={{
          title: "FinanceAI Assistant",
          initial: `💰 **Welcome to FinanceAI!**

**Quick Start:**
• 📊 "What's AAPL price?"
• 🔍 "Should I buy Tesla?" (deep research)
• 📈 "Analyze my portfolio"
• 💼 "Add 10 shares of Apple at $271"
• 🔔 "Alert me if Apple drops below $160"
• 💸 "I spent $45 on lunch"
• 📝 "Add Netflix $15 monthly"
• 🎯 "Tell me about Lenskart IPO"

I help with portfolio tracking, stock analysis, IPO research, expenses, and subscriptions!`
        }}
      />
    </main>
  );
}

function MainDashboard({ themeColor }: { themeColor: string }) {
  const { state, setState } = useCoAgent<AgentState>({
    name: "financeAgent",
    initialState: {
      portfolio: [],
      alerts: [],
      expenses: [],
      watchlist: [],
      billReminders: [],
    },
  });

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [latestNews, setLatestNews] = useState<any[]>([]);
  const [stockRecommendations, setStockRecommendations] = useState<any[]>([]);
  const [relatedNews, setRelatedNews] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [livePortfolio, setLivePortfolio] = useState<any[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioGain, setPortfolioGain] = useState(0);
  const [portfolioCostBasis, setPortfolioCostBasis] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [monthlySubscriptions, setMonthlySubscriptions] = useState(0);
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadStatus("📄 Reading CSV file...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      console.log('📄 CSV Content:', text);
      
      setUploadStatus("🔍 Parsing stocks...");
      
      const lines = text.trim().split('\n');
      const newStocks: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          const symbol = parts[0].toUpperCase();
          const quantity = parseFloat(parts[1]);
          const price = parseFloat(parts[2]);
          
          if (symbol && !isNaN(quantity) && !isNaN(price)) {
            newStocks.push({
              symbol,
              quantity,
              purchasePrice: price,
            });
          }
        }
      }
      
      console.log('✅ Parsed stocks:', newStocks);
      
      if (newStocks.length > 0) {
        setUploadStatus(`✅ Importing ${newStocks.length} stocks...`);
        
        setState((prev: any) => ({
          ...prev,
          portfolio: [...(prev.portfolio || []), ...newStocks]
        }));
        
        setTimeout(() => {
          setUploadStatus(`🎉 Successfully imported ${newStocks.length} stocks!`);
          setTimeout(() => {
            setShowUploadModal(false);
            setUploadStatus("");
          }, 2000);
        }, 500);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadStatus('❌ No valid data found in CSV. Check format.');
      }
    };
    
    reader.onerror = () => {
      setUploadStatus('❌ Error reading file. Please try again.');
    };
    
    reader.readAsText(file);
  };

  // ✅ NEW: Analyze Portfolio Function
  const analyzePortfolio = async () => {
    if (!state.portfolio || state.portfolio.length === 0) {
      alert('❌ No stocks in portfolio to analyze');
      return;
    }

    setIsAnalyzing(true);
    setShowAnalysisModal(true);

    try {
      // Calculate current portfolio values
      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
      
      const portfolioWithPrices = await Promise.all(
        state.portfolio.map(async (holding) => {
          try {
            if (apiKey) {
              const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${apiKey}`);
              const data = await response.json();
              return {
                ...holding,
                currentPrice: data.c || holding.purchasePrice,
              };
            }
            return { ...holding, currentPrice: holding.purchasePrice };
          } catch {
            return { ...holding, currentPrice: holding.purchasePrice };
          }
        })
      );

      // Calculate metrics
      const totalValue = portfolioWithPrices.reduce((sum, h) => sum + (h.currentPrice * h.quantity), 0);
      const totalCost = portfolioWithPrices.reduce((sum, h) => sum + (h.purchasePrice * h.quantity), 0);
      const numHoldings = portfolioWithPrices.length;
      
      // Diversification score
      const diversificationScore = Math.min(numHoldings * 20, 100);
      
      // Concentration risk
      const concentrationRisk = portfolioWithPrices.map(h => ((h.currentPrice * h.quantity) / totalValue) * 100);
      const maxConcentration = Math.max(...concentrationRisk);
      const riskScore = Math.min(maxConcentration * 2, 100);
      
      // Generate recommendations
      const recs: string[] = [];
      if (numHoldings < 3) recs.push('Add more stocks for better diversification (aim for 5-10)');
      if (maxConcentration > 40) recs.push(`Reduce concentration in your top holding (${maxConcentration.toFixed(0)}% of portfolio)`);
      if (numHoldings >= 5) recs.push('Good diversification! Consider rebalancing quarterly');
      if (diversificationScore < 60) recs.push('Diversify across different sectors (tech, healthcare, finance)');
      if (riskScore > 70) recs.push('High concentration risk - consider spreading investments more evenly');
      
      // Sector recommendations
      const techStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'];
      const hasTech = portfolioWithPrices.some(h => techStocks.includes(h.symbol));
      if (!hasTech) recs.push('Consider adding tech stocks for growth potential');
      
      const overallRating = diversificationScore > 70 && riskScore < 50 ? 'EXCELLENT' :
                            diversificationScore > 50 && riskScore < 70 ? 'GOOD' :
                            'NEEDS IMPROVEMENT';
      
      setAnalysisResult({
        overallRating,
        riskScore: Math.round(riskScore),
        diversificationScore: Math.round(diversificationScore),
        recommendations: recs,
        totalValue,
        totalCost,
        numHoldings,
      });
      
      setRecommendations(recs);
    } catch (error) {
      console.error('Analysis error:', error);
      alert('❌ Error analyzing portfolio');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ✅ NEW: Generate stock recommendations based on portfolio
  const generateStockRecommendations = async () => {
    if (!state.portfolio || state.portfolio.length === 0) return;

    try {
      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
      if (!apiKey) return;

      // Get portfolio symbols
      const portfolioSymbols = state.portfolio.map(h => h.symbol);
      
      // Common popular stocks for recommendations
      const allStocks = [
        { symbol: 'AAPL', name: 'Apple', sector: 'Technology' },
        { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology' },
        { symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology' },
        { symbol: 'AMZN', name: 'Amazon', sector: 'Technology' },
        { symbol: 'TSLA', name: 'Tesla', sector: 'Automotive' },
        { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
        { symbol: 'META', name: 'Meta', sector: 'Technology' },
        { symbol: 'JPM', name: 'JP Morgan', sector: 'Finance' },
        { symbol: 'V', name: 'Visa', sector: 'Finance' },
        { symbol: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
        { symbol: 'WMT', name: 'Walmart', sector: 'Retail' },
        { symbol: 'PG', name: 'Procter & Gamble', sector: 'Consumer' },
      ];

      // Filter out stocks already in portfolio
      const suggestedStocks = allStocks.filter(s => !portfolioSymbols.includes(s.symbol));

      // Fetch current prices for top 5 suggestions
      const recommendations = await Promise.all(
        suggestedStocks.slice(0, 5).map(async (stock) => {
          try {
            const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${apiKey}`);
            const data = await response.json();
            
            const currentPrice = data.c || 0;
            const changePercent = data.dp || 0;
            
            let action = 'HOLD';
            if (changePercent > 5) action = 'STRONG BUY';
            else if (changePercent > 2) action = 'BUY';
            else if (changePercent < -5) action = 'SELL';
            else if (changePercent < -2) action = 'CAUTION';
            
            // Determine reason based on portfolio
            let reason = '';
            if (!portfolioSymbols.some(s => allStocks.find(st => st.symbol === s)?.sector === stock.sector)) {
              reason = `Diversify into ${stock.sector} sector`;
            } else if (currentPrice > 0 && changePercent > 3) {
              reason = 'Strong momentum (+' + changePercent.toFixed(1) + '%)';
            } else if (stock.sector === 'Technology' && !portfolioSymbols.includes(stock.symbol)) {
              reason = 'Tech sector growth potential';
            } else {
              reason = 'Solid long-term hold';
            }

            return {
              ...stock,
              currentPrice,
              changePercent,
              action,
              reason,
            };
          } catch {
            return null;
          }
        })
      );

      setStockRecommendations(recommendations.filter(r => r !== null));
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  };

  // ✅ NEW: Fetch related news based on portfolio
  const fetchRelatedNews = async () => {
    if (!state.portfolio || state.portfolio.length === 0) return;

    try {
      const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY || process.env.NEWS_API_KEY;
      if (!apiKey) return;

      // Get portfolio company names
      const symbols = state.portfolio.map(h => h.symbol).join(' OR ');
      
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(symbols)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`
      );
      const data = await response.json();
      
      if (data.articles) {
        setRelatedNews(data.articles.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching related news:', error);
    }
  };

  // ✅ NEW: Fetch latest news
  const fetchLatestNews = async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_NEWS_API_KEY || process.env.NEWS_API_KEY;
      if (!apiKey) return;

      const response = await fetch(`https://newsapi.org/v2/top-headlines?category=business&country=us&pageSize=5&apiKey=${apiKey}`);
      const data = await response.json();
      
      if (data.articles) {
        setLatestNews(data.articles.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  };

  const updatePortfolioPrices = useCallback(async () => {
    if (!state.portfolio || state.portfolio.length === 0) {
      setLivePortfolio([]);
      setPortfolioValue(0);
      setPortfolioGain(0);
      setPortfolioCostBasis(0);
      return;
    }

    setIsLoadingPrices(true);
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
      
      const updated = await Promise.all(
        state.portfolio.map(async (holding) => {
          try {
            let currentPrice = holding.purchasePrice;
            
            if (apiKey) {
              const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${apiKey}`);
              const data = await response.json();
              currentPrice = data.c || holding.purchasePrice;
            }
            
            const totalValue = currentPrice * holding.quantity;
            const totalCost = holding.purchasePrice * holding.quantity;
            const gainLoss = totalValue - totalCost;
            const gainLossPercent = ((gainLoss / totalCost) * 100);
            
            return {
              ...holding,
              currentPrice,
              totalValue,
              totalCost,
              gainLoss,
              gainLossPercent,
            };
          } catch (error) {
            console.error(`Error fetching ${holding.symbol}:`, error);
            return {
              ...holding,
              currentPrice: holding.purchasePrice,
              totalValue: holding.purchasePrice * holding.quantity,
              totalCost: holding.purchasePrice * holding.quantity,
              gainLoss: 0,
              gainLossPercent: 0,
            };
          }
        })
      );
      
      setLivePortfolio(updated);
      const totalValue = updated.reduce((sum, h) => sum + h.totalValue, 0);
      const totalCost = updated.reduce((sum, h) => sum + h.totalCost, 0);
      const totalGain = totalValue - totalCost;
      
      setPortfolioValue(totalValue);
      setPortfolioCostBasis(totalCost);
      setPortfolioGain(totalGain);
      setLastUpdate(new Date());
      
      console.log('💰 Portfolio updated:', {
        stocks: updated.length,
        totalValue: totalValue.toFixed(2),
        totalGain: totalGain.toFixed(2)
      });
    } catch (error) {
      console.error('❌ Error updating portfolio:', error);
    } finally {
      setIsLoadingPrices(false);
    }
  }, [state.portfolio]);

  useEffect(() => {
    console.log('📊 Portfolio state changed:', state.portfolio);
    updatePortfolioPrices();
    // ✅ NEW: Generate recommendations when portfolio changes
    if (state.portfolio && state.portfolio.length > 0) {
      generateStockRecommendations();
      fetchRelatedNews();
    }
  }, [state.portfolio, updatePortfolioPrices]);

  useEffect(() => {
    if (state.portfolio && state.portfolio.length > 0) {
      const interval = setInterval(() => {
        console.log('🔄 Auto-refreshing prices...');
        updatePortfolioPrices();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [state.portfolio, updatePortfolioPrices]);

  useEffect(() => {
    if (state.expenses && state.expenses.length > 0) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const monthlyTotal = state.expenses
        .filter(exp => {
          const expDate = new Date(exp.date);
          return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
        })
        .reduce((sum, exp) => sum + exp.amount, 0);
      
      setMonthlyExpenses(monthlyTotal);
    } else {
      setMonthlyExpenses(0);
    }
  }, [state.expenses]);

  // ✅ FIXED: Update when subscriptions change
  useEffect(() => {
    console.log('📝 Subscriptions updated:', state.billReminders?.length);
    if (state.billReminders && state.billReminders.length > 0) {
      const total = state.billReminders.reduce((sum, bill) => sum + bill.amount, 0);
      setMonthlySubscriptions(total);
    } else {
      setMonthlySubscriptions(0);
    }
  }, [state.billReminders]);

  useCopilotAction({
    name: "stockAnalyzerTool",
    description: "Display stock analysis results",
    available: "frontend",
    parameters: [{ name: "symbol", type: "string", required: true }],
    render: ({ args, result, status }) => (
      <StockAnalysisCard symbol={args.symbol} themeColor={themeColor} result={result as StockAnalysisResult} status={status} />
    ),
  });

  useCopilotAction({
    name: "smartStockResearchTool",
    description: "Display comprehensive stock research",
    available: "frontend",
    parameters: [{ name: "query", type: "string", required: true }],
    render: ({ args, result, status }) => (
      <StockResearchCard query={args.query} themeColor={themeColor} result={result as StockResearchResult} status={status} />
    ),
  });

  useCopilotAction({
    name: "portfolioManagerTool",
    description: "Display portfolio updates",
    available: "frontend",
    render: ({ args, result, status }) => (
      <PortfolioUpdateCard action={args.action} themeColor={themeColor} result={result} status={status} />
    ),
  });

  useCopilotAction({
    name: "ipoResearchTool",
    description: "Display IPO research results",
    available: "frontend",
    parameters: [{ name: "companyName", type: "string", required: true }],
    render: ({ args, result, status }) => (
      <IPOResearchCard companyName={args.companyName} themeColor={themeColor} result={result} status={status} />
    ),
  });

  const gainPercent = portfolioCostBasis > 0 ? (portfolioGain / portfolioCostBasis) * 100 : 0;

  return (
    <div 
      className="min-h-screen w-screen flex justify-center items-start py-8 transition-all duration-500"
      style={{
        background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}05 100%)`,
      }}
    >
      <div className="max-w-7xl w-full px-4">
        
        <div 
          className="bg-gradient-to-r p-8 rounded-3xl shadow-2xl mb-8 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)`,
          }}
        >
          <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <div className="flex justify-between items-center mb-3">
              <div className="flex-1"></div>
              <h1 className="text-5xl font-bold text-white text-center flex-1 drop-shadow-lg">
                💰 FinanceAI Dashboard
              </h1>
              <div className="flex-1 flex justify-end gap-3">
                <button
                  onClick={() => updatePortfolioPrices()}
                  disabled={isLoadingPrices}
                  className="bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all transform hover:scale-105 disabled:opacity-50 backdrop-blur-sm shadow-lg"
                >
                  {isLoadingPrices ? '🔄 Updating...' : '🔄 Refresh'}
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all transform hover:scale-105 backdrop-blur-sm shadow-lg"
                >
                  📊 Import CSV
                </button>
              </div>
            </div>
            <p className="text-white/90 text-center text-lg drop-shadow">
              Your AI-powered financial command center • Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>

        {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" onClick={() => !uploadStatus && setShowUploadModal(false)}>
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-3xl font-bold mb-6 text-gray-800 flex items-center gap-3">
                📊 Import Portfolio CSV
              </h2>
              
              {uploadStatus ? (
                <div className="text-center py-8">
                  <p className="text-2xl mb-4">{uploadStatus}</p>
                  {uploadStatus.includes('Reading') || uploadStatus.includes('Parsing') || uploadStatus.includes('Importing') && (
                    <div className="animate-pulse">⏳</div>
                  )}
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="text-gray-700 mb-3 font-semibold">Required CSV format:</p>
                    <div className="bg-gray-100 p-4 rounded-xl font-mono text-sm mb-4 border-2 border-gray-200">
                      <div className="text-green-600">Symbol,Quantity,Price</div>
                      <div>AAPL,10,271.00</div>
                      <div>MSFT,5,526.00</div>
                      <div>GOOGL,3,178.50</div>
                      <div>TSLA,2,245.00</div>
                    </div>
                    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                      <p className="text-sm text-blue-900">
                        <strong>Tips:</strong><br/>
                        • First line must be header<br/>
                        • No spaces around commas<br/>
                        • Price = your purchase price per share<br/>
                        • Use stock ticker symbols (AAPL, MSFT, etc.)
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}
                    className="w-full text-white py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 shadow-lg mb-3"
                  >
                    📂 Choose CSV File
                  </button>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-xl font-semibold transition-all"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-2xl shadow-xl transform transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white/90 text-sm font-bold uppercase tracking-wide">Portfolio Value</h3>
              <span className="text-3xl">📊</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-sm font-bold ${portfolioGain >= 0 ? 'text-green-100' : 'text-red-100'}`}>
              {portfolioGain >= 0 ? '↑' : '↓'} ${Math.abs(portfolioGain).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {portfolioCostBasis > 0 && ` (${gainPercent >= 0 ? '+' : ''}${gainPercent.toFixed(2)}%)`}
            </div>
            {portfolioCostBasis > 0 && (
              <div className="text-white/70 text-xs mt-2">
                Cost basis: ${portfolioCostBasis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-2xl shadow-xl transform transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white/90 text-sm font-bold uppercase tracking-wide">Monthly Expenses</h3>
              <span className="text-3xl">💸</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              ${monthlyExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-white/80 text-sm">
              {state.expenses?.length || 0} transactions this month
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-2xl shadow-xl transform transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white/90 text-sm font-bold uppercase tracking-wide">Subscriptions</h3>
              <span className="text-3xl">📝</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2">
              ${monthlySubscriptions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-white/80 text-sm">
              {state.billReminders?.length || 0} active subscription{state.billReminders?.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* ✅ NEW: Quick Actions Section */}
        {livePortfolio.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-200 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">⚡ Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={analyzePortfolio}
                disabled={isAnalyzing}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50"
              >
                {isAnalyzing ? '⏳ Analyzing...' : '📊 Analyze Portfolio'}
              </button>
              <button
                onClick={() => updatePortfolioPrices()}
                disabled={isLoadingPrices}
                className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50"
              >
                {isLoadingPrices ? '⏳ Refreshing...' : '🔄 Refresh Prices'}
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105"
              >
                📂 Import CSV
              </button>
            </div>
          </div>
        )}

        {/* ✅ NEW: Recommendations Section */}
        {recommendations.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-200 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">💡 Smart Recommendations</h2>
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <div key={index} className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-gray-800 font-semibold">✓ {rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ NEW: Stock Recommendations Section */}
        {stockRecommendations.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-200 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🎯 Recommended Stocks for You</h2>
            <p className="text-gray-600 mb-4 text-sm">Based on your portfolio diversification and market trends</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stockRecommendations.map((stock, index) => (
                <div key={index} className="bg-gradient-to-br from-green-50 to-blue-50 p-5 rounded-xl border border-green-200 hover:shadow-lg transition-all transform hover:scale-105">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{stock.symbol}</h3>
                      <p className="text-gray-600 text-sm">{stock.name}</p>
                      <p className="text-gray-500 text-xs">{stock.sector}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      stock.action === 'STRONG BUY' || stock.action === 'BUY' ? 'bg-green-500 text-white' :
                      stock.action === 'HOLD' ? 'bg-blue-500 text-white' :
                      'bg-orange-500 text-white'
                    }`}>
                      {stock.action}
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="text-2xl font-bold text-gray-900">${stock.currentPrice.toFixed(2)}</div>
                    <div className={`text-sm font-semibold ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {stock.changePercent >= 0 ? '↑' : '↓'} {Math.abs(stock.changePercent).toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-white/50 p-3 rounded-lg">
                    <p className="text-gray-700 text-sm font-medium">💡 {stock.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✅ NEW: Related News Section */}
        {relatedNews.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-200 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📰 News About Your Holdings</h2>
            <div className="space-y-4">
              {relatedNews.map((article, index) => (
                <a
                  key={index}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200 hover:shadow-lg transition-all transform hover:scale-[1.02]"
                >
                  {article.urlToImage && (
                    <img 
                      src={article.urlToImage} 
                      alt={article.title}
                      className="w-full h-40 object-cover rounded-lg mb-3"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <h3 className="text-gray-900 font-bold mb-2">{article.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{article.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span className="font-semibold">{article.source.name}</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ✅ Latest Financial News Section */}
        {latestNews.length > 0 && (
          <div className="bg-white/90 backdrop-blur-xl p-6 rounded-2xl shadow-xl border border-gray-200 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">📰 Latest Financial News</h2>
            <div className="space-y-4">
              {latestNews.map((article, index) => (
                <a
                  key={index}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-gradient-to-r from-gray-50 to-white p-4 rounded-xl border border-gray-200 hover:shadow-lg transition-all transform hover:scale-[1.02]"
                >
                  <h3 className="text-gray-900 font-bold mb-2">{article.title}</h3>
                  <p className="text-gray-600 text-sm mb-2">{article.description}</p>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{article.source.name}</span>
                    <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="space-y-8">
            
            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                  📈 Portfolio
                  {isLoadingPrices && <span className="text-sm text-gray-500 animate-pulse">(updating...)</span>}
                </h2>
                {livePortfolio.length > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    Live • Auto-refresh: 30s
                  </span>
                )}
              </div>
              
              {livePortfolio.length > 0 ? (
                <div className="space-y-4">
                  {livePortfolio.map((holding, index) => {
                    const isPositive = holding.gainLoss >= 0;
                    return (
                      <div 
                        key={index} 
                        className="bg-gradient-to-r from-gray-50 to-white p-5 rounded-xl hover:shadow-lg transition-all border border-gray-200 transform hover:scale-[1.02]"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-gray-900 font-bold text-xl">{holding.symbol}</div>
                            <div className="text-gray-600 text-sm">{holding.quantity} shares</div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-900 font-bold text-lg">
                              ${holding.currentPrice.toFixed(2)}
                            </div>
                            <div className="text-gray-500 text-xs">
                              Bought: ${holding.purchasePrice.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                          <div className="text-gray-700 font-semibold">
                            Value: ${holding.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className={`text-sm font-bold px-3 py-1 rounded-full ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isPositive ? '↑' : '↓'} ${Math.abs(holding.gainLoss).toFixed(2)} ({holding.gainLossPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div className="bg-gradient-to-r from-gray-100 to-gray-50 p-5 rounded-xl border-2 border-gray-300 mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-700 font-bold text-lg">Total Portfolio:</span>
                      <span className="text-gray-900 font-bold text-2xl">
                        ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Total Gain/Loss:</span>
                      <span className={`font-bold text-lg ${portfolioGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolioGain >= 0 ? '+' : ''} ${portfolioGain.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({gainPercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-600 text-lg mb-3">No holdings yet</p>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-md mx-auto">
                    <p className="text-blue-900 text-sm mb-2 font-semibold">Get started:</p>
                    <p className="text-blue-800 text-sm mb-1">💬 "Add 10 shares of Apple at $271"</p>
                    <p className="text-blue-800 text-sm">📊 Or click "Import CSV" above</p>
                  </div>
                </div>
              )}
            </div>

            {state.alerts && state.alerts.length > 0 && (
              <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  🔔 Price Alerts
                </h2>
                <div className="space-y-3">
                  {state.alerts.map((alert, index) => (
                    <div key={index} className="bg-yellow-50 border-2 border-yellow-300 p-4 rounded-xl">
                      <div className="text-gray-900 font-bold text-lg">
                        {alert.symbol} {alert.condition} ${alert.targetPrice.toFixed(2)}
                      </div>
                      <div className="text-gray-600 text-sm mt-1">
                        Will notify when price condition is met
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            
            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-gray-200">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">📝 Subscriptions</h2>
              
              {state.billReminders && state.billReminders.length > 0 ? (
                <div className="space-y-4">
                  {state.billReminders.map((bill, index) => (
                    <div key={index} className="bg-gradient-to-r from-purple-50 to-blue-50 p-5 rounded-xl border border-purple-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-gray-900 font-bold text-lg">{bill.name}</div>
                          <div className="text-gray-600 text-sm">Due: Day {bill.dueDay} of month</div>
                        </div>
                        <div className="text-gray-900 font-bold text-xl">
                          ${bill.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-gray-300">
                    <div className="flex justify-between items-center bg-gradient-to-r from-purple-100 to-blue-100 p-4 rounded-xl">
                      <span className="text-gray-800 font-bold text-lg">Monthly Total:</span>
                      <span className="text-gray-900 font-bold text-2xl">
                        ${monthlySubscriptions.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <p className="text-gray-600 text-lg mb-3">No subscriptions tracked</p>
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 max-w-md mx-auto">
                    <p className="text-purple-900 text-sm">
                      💬 "Add Netflix subscription $15 monthly"
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-gray-200">
              <h2 className="text-3xl font-bold text-gray-800 mb-6">💸 Recent Expenses</h2>
              
              {state.expenses && state.expenses.length > 0 ? (
                <div className="space-y-3">
                  {state.expenses.slice(-5).reverse().map((expense, index) => (
                    <div key={index} className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl flex justify-between items-center border border-orange-200">
                      <div>
                        <div className="text-gray-900 font-bold capitalize">{expense.category}</div>
                        <div className="text-gray-600 text-sm">{expense.description}</div>
                        <div className="text-gray-500 text-xs">{new Date(expense.date).toLocaleDateString()}</div>
                      </div>
                      <div className="text-gray-900 font-bold text-lg">
                        ${expense.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 border-t-2 border-gray-300">
                    <div className="flex justify-between items-center bg-gradient-to-r from-orange-100 to-red-100 p-4 rounded-xl">
                      <span className="text-gray-800 font-bold text-lg">This Month:</span>
                      <span className="text-gray-900 font-bold text-2xl">
                        ${monthlyExpenses.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">💸</div>
                  <p className="text-gray-600 text-lg mb-3">No expenses tracked</p>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 max-w-md mx-auto">
                    <p className="text-orange-900 text-sm">
                      💬 "I spent $45 on lunch"
                    </p>
                  </div>
                </div>
              )}
            </div>

            {state.watchlist && state.watchlist.length > 0 && (
              <div className="bg-white/90 backdrop-blur-xl p-8 rounded-2xl shadow-xl border border-gray-200">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">⭐ Watchlist</h2>
                <div className="flex flex-wrap gap-3">
                  {state.watchlist.map((symbol, index) => (
                    <div 
                      key={index} 
                      className="bg-gradient-to-r from-yellow-100 to-amber-100 px-5 py-3 rounded-full text-gray-900 font-bold hover:shadow-lg transition-all cursor-pointer border border-yellow-300 transform hover:scale-105"
                    >
                      {symbol}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {(!state.portfolio || state.portfolio.length === 0) &&
         (!state.expenses || state.expenses.length === 0) &&
         (!state.billReminders || state.billReminders.length === 0) && (
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-3xl shadow-2xl text-center mt-8 border border-gray-200">
            <div className="text-7xl mb-6">👋</div>
            <h2 className="text-4xl font-bold text-gray-800 mb-4">Welcome to FinanceAI!</h2>
            <p className="text-gray-600 text-lg mb-8">Start managing your finances intelligently with AI</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm max-w-3xl mx-auto">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200 text-left">
                <div className="font-bold text-gray-900 mb-2 text-lg">📊 Stock Analysis</div>
                <div className="text-gray-700">"Analyze Tesla stock"</div>
                <div className="text-gray-700">"What's AAPL price?"</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-5 rounded-xl border border-green-200 text-left">
                <div className="font-bold text-gray-900 mb-2 text-lg">💼 Portfolio Management</div>
                <div className="text-gray-700">"Add 10 Apple shares at $271"</div>
                <div className="text-gray-700">"Show my portfolio"</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-5 rounded-xl border border-orange-200 text-left">
                <div className="font-bold text-gray-900 mb-2 text-lg">💸 Expense Tracking</div>
                <div className="text-gray-700">"I spent $50 on groceries"</div>
                <div className="text-gray-700">"Show my expenses"</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-5 rounded-xl border border-purple-200 text-left">
                <div className="font-bold text-gray-900 mb-2 text-lg">🎯 IPO Research</div>
                <div className="text-gray-700">"Tell me about Lenskart IPO"</div>
                <div className="text-gray-700">"Should I invest in X IPO?"</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StockAnalysisCard({ symbol, themeColor, result, status }: any) {
  if (status !== "complete" || !result || !result.currentPrice) {
    return (
      <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-md w-full" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
        <div className="bg-white/20 backdrop-blur-md p-5 w-full">
          <p className="text-white animate-pulse text-lg">📊 Analyzing {symbol || 'stock'}...</p>
        </div>
      </div>
    );
  }

  const isPositive = (result.changePercent || 0) >= 0;

  return (
    <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-md w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
      <div className="bg-white/20 backdrop-blur-md p-6 w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white">{result.symbol}</h3>
            <p className="text-white/90 text-sm">{result.name}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">${result.currentPrice.toFixed(2)}</div>
            {result.change !== undefined && result.changePercent !== undefined && (
              <div className={`text-sm font-bold mt-1 px-3 py-1 rounded-full ${isPositive ? 'bg-green-500/30' : 'bg-red-500/30'}`}>
                {isPositive ? '↑' : '↓'} {Math.abs(result.change).toFixed(2)} ({Math.abs(result.changePercent).toFixed(2)}%)
              </div>
            )}
          </div>
        </div>
        {result.marketCap && (
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/30">
            <div className="bg-white/10 p-3 rounded-lg">
              <p className="text-white/70 text-xs uppercase tracking-wide">Market Cap</p>
              <p className="text-white font-bold text-sm mt-1">{result.marketCap}</p>
            </div>
            {result.peRatio && (
              <div className="bg-white/10 p-3 rounded-lg">
                <p className="text-white/70 text-xs uppercase tracking-wide">P/E Ratio</p>
                <p className="text-white font-bold text-sm mt-1">{result.peRatio.toFixed(2)}</p>
              </div>
            )}
            {result.week52High && (
              <div className="bg-white/10 p-3 rounded-lg">
                <p className="text-white/70 text-xs uppercase tracking-wide">52W High</p>
                <p className="text-white font-bold text-sm mt-1">${result.week52High.toFixed(2)}</p>
              </div>
            )}
          </div>
        )}
        <div className="mt-5 pt-5 border-t border-white/30">
          <div className="bg-white/20 px-4 py-3 rounded-xl">
            <p className="text-white font-bold text-sm">💡 {result.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StockResearchCard({ query, themeColor, result, status }: any) {
  if (status !== "complete" || !result || !result.analysis) {
    return (
      <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-2xl w-full" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
        <div className="bg-white/20 backdrop-blur-md p-5 w-full">
          <p className="text-white animate-pulse text-lg">🔍 Deep research on {query || 'stock'}...</p>
        </div>
      </div>
    );
  }

  const riskColors: Record<string, string> = { 
    'LOW': 'bg-green-500', 
    'MEDIUM': 'bg-yellow-500', 
    'HIGH': 'bg-orange-500', 
    'VERY HIGH': 'bg-red-500' 
  };

  return (
    <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-2xl w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
      <div className="bg-white/20 backdrop-blur-md p-6 w-full">
        <div className="mb-5">
          <h3 className="text-3xl font-bold text-white mb-2">{result.name}</h3>
          {result.currentPrice && result.currentPrice > 0 && (
            <p className="text-white/90 text-xl font-semibold">${result.currentPrice.toFixed(2)}</p>
          )}
        </div>
        <div className="mb-5">
          <div className={`inline-block px-4 py-2 rounded-full text-white text-sm font-bold ${riskColors[result.riskLevel]} shadow-lg`}>
            ⚠️ Risk Level: {result.riskLevel}
          </div>
        </div>
        {result.pros && result.pros.length > 0 && (
          <div className="mb-5 bg-white/10 p-4 rounded-xl">
            <h4 className="text-white font-bold mb-3 text-lg">✅ PROS</h4>
            <ul className="space-y-2">
              {result.pros.map((pro: string, idx: number) => (
                <li key={idx} className="text-white/90 text-sm flex items-start gap-2">
                  <span className="text-green-300 mt-0.5">•</span>
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.cons && result.cons.length > 0 && (
          <div className="mb-5 bg-white/10 p-4 rounded-xl">
            <h4 className="text-white font-bold mb-3 text-lg">❌ CONS</h4>
            <ul className="space-y-2">
              {result.cons.map((con: string, idx: number) => (
                <li key={idx} className="text-white/90 text-sm flex items-start gap-2">
                  <span className="text-red-300 mt-0.5">•</span>
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-5 pt-5 border-t border-white/30">
          <div className="bg-white/20 p-4 rounded-xl">
            <p className="text-white font-bold mb-2 text-lg">💡 Recommendation: {result.recommendation}</p>
            <p className="text-white/90 text-sm">{result.reasoning}</p>
          </div>
        </div>
        {result.news && result.news.length > 0 && (
          <div className="mt-5">
            <h4 className="text-white font-bold mb-3 text-lg">📰 Recent News</h4>
            <div className="space-y-2">
              {result.news.slice(0, 3).map((article: any, idx: number) => (
                <div key={idx} className="bg-white/10 p-3 rounded-lg text-white/90 text-xs">
                  <p className="font-semibold mb-1">{article.title}</p>
                  <p className="text-white/70">{article.source}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioUpdateCard({ action, themeColor, result, status }: any) {
  if (status !== "complete" || !result) {
    return (
      <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-md w-full" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
        <div className="bg-white/20 backdrop-blur-md p-5 w-full">
          <p className="text-white animate-pulse text-lg">💼 Updating portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-md w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
      <div className="bg-white/20 backdrop-blur-md p-5 w-full">
        <p className="text-white font-bold text-lg">✅ {result.message || 'Portfolio updated successfully!'}</p>
      </div>
    </div>
  );
}

function IPOResearchCard({ companyName, themeColor, result, status }: any) {
  if (status !== "complete" || !result) {
    return (
      <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-2xl w-full" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
        <div className="bg-white/20 backdrop-blur-md p-5 w-full">
          <p className="text-white animate-pulse text-lg">🎯 Researching {companyName} IPO...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl shadow-2xl mt-4 mb-4 max-w-2xl w-full overflow-hidden" style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` }}>
      <div className="bg-white/20 backdrop-blur-md p-6 w-full">
        <div className="mb-5">
          <h3 className="text-3xl font-bold text-white mb-2">🎯 {result.companyName} IPO</h3>
          <div className="inline-block px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-bold">
            Status: {result.ipoStatus}
          </div>
        </div>
        
        <div className="bg-white/10 p-5 rounded-xl mb-5">
          <div className="text-white/90 text-sm whitespace-pre-line leading-relaxed">
            {result.findings}
          </div>
        </div>

        {result.sources && result.sources.length > 0 && (
          <div className="mb-5">
            <h4 className="text-white font-bold mb-3 text-lg">🔗 Official Sources</h4>
            <div className="space-y-2">
              {result.sources.map((source: string, idx: number) => (
                <a 
                  key={idx} 
                  href={source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-white/10 p-3 rounded-lg text-white/90 text-sm hover:bg-white/20 transition-all"
                >
                  {source}
                </a>
              ))}
            </div>
          </div>
        )}

        {result.recommendation && (
          <div className="mt-5 pt-5 border-t border-white/30">
            <div className="bg-yellow-500/20 border border-yellow-500/40 p-4 rounded-xl">
              <p className="text-white font-bold mb-2">⚠️ Investment Advisory:</p>
              <p className="text-white/90 text-sm">{result.recommendation}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}