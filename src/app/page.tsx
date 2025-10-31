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
      description: "Theme color",
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
          initial: `💰 Welcome to FinanceAI!

**Quick Start:**
- 📊 "What's AAPL price?"
- 🔍 "Should I buy Tesla?" (deep research)
- 💼 "Add 10 shares of Apple at $271"
- 📈 "Analyze my portfolio"
- 🔔 "Alert me if Apple drops below $160"
- 💸 "I spent $45 on lunch"
- 📝 "Add Netflix $15 monthly"

I help with portfolio tracking, stock analysis, expenses, and subscriptions!`
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [livePortfolio, setLivePortfolio] = useState<any[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [portfolioGain, setPortfolioGain] = useState(0);
  const [portfolioCostBasis, setPortfolioCostBasis] = useState(0);
  const [monthlyExpenses, setMonthlyExpenses] = useState(0);
  const [monthlySubscriptions, setMonthlySubscriptions] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 🔧 FIXED: CSV Upload Handler
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; // FIXED: was event.target?.[0]
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      console.log('📄 CSV Content:', text);
      
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
              purchases: [{ quantity, price }], // Track for avg cost
            });
          }
        }
      }
      
      console.log('✅ Parsed stocks:', newStocks);
      
      if (newStocks.length > 0) {
        setState((prev: any) => ({
          ...prev,
          portfolio: [...(prev.portfolio || []), ...newStocks]
        }));
        
        alert(`✅ Successfully imported ${newStocks.length} stocks!`);
        setShowUploadModal(false);
        
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        alert('❌ No valid data found.\n\nExpected format:\nSymbol,Quantity,Price\nAAPL,10,271.00');
      }
    };
    
    reader.onerror = () => {
      alert('❌ Error reading file');
    };
    
    reader.readAsText(file);
  };

  // 🔧 FIXED: Calculate average cost from purchases array
  const calculateAvgCost = (holding: any) => {
    if (holding.purchases && holding.purchases.length > 0) {
      const totalCost = holding.purchases.reduce((sum: number, p: any) => 
        sum + (p.price * p.quantity), 0);
      const totalQty = holding.purchases.reduce((sum: number, p: any) => 
        sum + p.quantity, 0);
      return totalCost / totalQty;
    }
    return holding.purchasePrice;
  };

  // 🔧 FIXED: Update portfolio with ACCURATE profit calculations
  const updatePortfolioPrices = useCallback(async () => {
    if (!state.portfolio || state.portfolio.length === 0) {
      setLivePortfolio([]);
      setPortfolioValue(0);
      setPortfolioGain(0);
      setPortfolioCostBasis(0);
      return;
    }

    setIsUpdating(true);
    
    try {
      const apiKey = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';
      
      const updated = await Promise.all(
        state.portfolio.map(async (holding) => {
          let currentPrice = holding.purchasePrice;
          
          // Fetch current price
          if (apiKey) {
            try {
              const response = await fetch(
                `https://finnhub.io/api/v1/quote?symbol=${holding.symbol}&token=${apiKey}`
              );
              const data = await response.json();
              if (data.c && data.c > 0) {
                currentPrice = data.c;
              }
            } catch (error) {
              console.error(`Error fetching ${holding.symbol}:`, error);
            }
          }
          
          // 🎯 ACCURATE: Calculate average cost basis
          const avgCost = calculateAvgCost(holding);
          
          // 🎯 ACCURATE: Calculate profit/loss
          const totalValue = currentPrice * holding.quantity;
          const totalCost = avgCost * holding.quantity;
          const gainLoss = totalValue - totalCost;
          const gainLossPercent = (gainLoss / totalCost) * 100;
          
          return {
            ...holding,
            currentPrice,
            avgCost,
            totalValue,
            totalCost,
            gainLoss,
            gainLossPercent,
          };
        })
      );
      
      // 🎯 ACCURATE: Calculate portfolio totals
      const totalValue = updated.reduce((sum, h) => sum + h.totalValue, 0);
      const totalCost = updated.reduce((sum, h) => sum + h.totalCost, 0);
      const totalGain = totalValue - totalCost;
      
      setLivePortfolio(updated);
      setPortfolioValue(totalValue);
      setPortfolioCostBasis(totalCost);
      setPortfolioGain(totalGain);
      setLastUpdate(new Date());
      
      console.log('💰 Portfolio updated:', {
        stocks: updated.length,
        totalValue: totalValue.toFixed(2),
        totalCost: totalCost.toFixed(2),
        totalGain: totalGain.toFixed(2),
        gainPercent: ((totalGain / totalCost) * 100).toFixed(2) + '%',
      });
    } catch (error) {
      console.error('❌ Error updating portfolio:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [state.portfolio]);

  // Update on portfolio change
  useEffect(() => {
    console.log('📊 Portfolio state changed:', state.portfolio?.length || 0, 'holdings');
    updatePortfolioPrices();
  }, [state.portfolio, updatePortfolioPrices]);

  // Auto-refresh prices every 30 seconds
  useEffect(() => {
    if (state.portfolio && state.portfolio.length > 0) {
      const interval = setInterval(() => {
        updatePortfolioPrices();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [state.portfolio, updatePortfolioPrices]);

  // Calculate monthly expenses
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
    }
  }, [state.expenses]);

  // Calculate monthly subscriptions
  useEffect(() => {
    if (state.billReminders && state.billReminders.length > 0) {
      const total = state.billReminders.reduce((sum, bill) => sum + bill.amount, 0);
      setMonthlySubscriptions(total);
    }
  }, [state.billReminders]);

  // Generative UI for tools
  useCopilotAction({
    name: "stockAnalyzerTool",
    description: "Display stock analysis",
    available: "frontend",
    parameters: [{ name: "symbol", type: "string", required: true }],
    render: ({ args, result, status }) => (
      <StockAnalysisCard 
        symbol={args.symbol} 
        themeColor={themeColor} 
        result={result as StockAnalysisResult} 
        status={status} 
      />
    ),
  });

  useCopilotAction({
    name: "smartStockResearchTool",
    description: "Display stock research",
    available: "frontend",
    parameters: [{ name: "query", type: "string", required: true }],
    render: ({ args, result, status }) => (
      <StockResearchCard 
        query={args.query} 
        themeColor={themeColor} 
        result={result as StockResearchResult} 
        status={status} 
      />
    ),
  });

  const portfolioReturnPercent = portfolioCostBasis > 0 ? 
    (portfolioGain / portfolioCostBasis) * 100 : 0;

  return (
    <div 
      style={{ backgroundColor: themeColor }} 
      className="min-h-screen w-screen flex justify-center items-start py-8 transition-colors duration-300"
    >
      <div className="max-w-6xl w-full px-4">
        
        {/* Header */}
        <div className="bg-white/20 backdrop-blur-md p-6 rounded-2xl shadow-xl mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1"></div>
            <h1 className="text-4xl font-bold text-white text-center flex-1">
              💰 FinanceAI Dashboard
            </h1>
            <div className="flex-1 flex justify-end gap-2">
              {isUpdating && (
                <span className="text-white/70 text-sm self-center animate-pulse">
                  Updating...
                </span>
              )}
              {lastUpdate && !isUpdating && (
                <span className="text-white/60 text-xs self-center">
                  Updated {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => setShowUploadModal(true)}
                className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                📊 Import CSV
              </button>
            </div>
          </div>
          <p className="text-gray-200 text-center italic">
            Live prices • Updates every 30s
          </p>
        </div>

        {/* CSV Upload Modal */}
        {showUploadModal && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" 
            onClick={() => setShowUploadModal(false)}
          >
            <div 
              className="bg-white rounded-2xl p-6 max-w-md w-full mx-4" 
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold mb-4 text-gray-800">
                📊 Import Portfolio CSV
              </h2>
              <div className="mb-4">
                <p className="text-gray-600 mb-2">Expected format:</p>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm mb-4">
                  Symbol,Quantity,Price<br/>
                  AAPL,10,271.00<br/>
                  MSFT,5,526.00<br/>
                  GOOGL,3,178.50
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
                  className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition"
                >
                  Choose CSV File
                </button>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Portfolio Value */}
          <div className="bg-white/20 backdrop-blur-md p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white/80 text-sm font-semibold">Portfolio Value</h3>
              <span className="text-2xl">📊</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${portfolioValue.toLocaleString('en-US', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </div>
            <div className={`text-sm font-semibold ${
              portfolioGain >= 0 ? 'text-green-300' : 'text-red-300'
            }`}>
              {portfolioGain >= 0 ? '↑' : '↓'} $
              {Math.abs(portfolioGain).toFixed(2)} 
              {portfolioCostBasis > 0 && 
                ` (${portfolioReturnPercent >= 0 ? '+' : ''}${portfolioReturnPercent.toFixed(2)}%)`
              }
            </div>
            {portfolioCostBasis > 0 && (
              <div className="text-xs text-white/60 mt-1">
                Cost: ${portfolioCostBasis.toFixed(2)}
              </div>
            )}
          </div>

          {/* Monthly Expenses */}
          <div className="bg-white/20 backdrop-blur-md p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white/80 text-sm font-semibold">Monthly Expenses</h3>
              <span className="text-2xl">💸</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${monthlyExpenses.toFixed(2)}
            </div>
            <div className="text-sm text-white/70">This month's spending</div>
          </div>

          {/* Subscriptions */}
          <div className="bg-white/20 backdrop-blur-md p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white/80 text-sm font-semibold">Subscriptions</h3>
              <span className="text-2xl">📝</span>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              ${monthlySubscriptions.toFixed(2)}
            </div>
            <div className="text-sm text-white/70">
              {state.billReminders?.length || 0} active
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Portfolio Holdings */}
            <div className="bg-white/20 backdrop-blur-md p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">📈 Portfolio</h2>
                {livePortfolio.length > 0 && (
                  <span className="text-xs text-white/60">
                    Live • {livePortfolio.length} stocks
                  </span>
                )}
              </div>
              
              {livePortfolio.length > 0 ? (
                <div className="space-y-3">
                  {livePortfolio.map((holding, index) => {
                    const isPositive = holding.gainLoss >= 0;
                    return (
                      <div 
                        key={index} 
                        className="bg-white/10 p-4 rounded-lg hover:bg-white/15 transition"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-white font-bold text-lg">
                              {holding.symbol}
                            </div>
                            <div className="text-white/70 text-sm">
                              {holding.quantity} shares
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-semibold">
                              ${holding.currentPrice.toFixed(2)}
                            </div>
                            <div className="text-white/60 text-xs">
                              Avg: ${holding.avgCost.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-white/10">
                          <div className="text-white/80 text-sm">
                            Value: ${holding.totalValue.toFixed(2)}
                          </div>
                          <div className={`text-sm font-semibold ${
                            isPositive ? 'text-green-300' : 'text-red-300'
                          }`}>
                            {isPositive ? '↑' : '↓'} $
                            {Math.abs(holding.gainLoss).toFixed(2)} 
                            ({holding.gainLossPercent >= 0 ? '+' : ''}
                            {holding.gainLossPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-white/70">
                  <p className="mb-2">No holdings yet</p>
                  <p className="text-sm">Say: "Add 10 shares of Apple at $271"</p>
                  <p className="text-sm mt-2">Or click "Import CSV"</p>
                </div>
              )}
            </div>

            {/* Alerts */}
            {state.alerts && state.alerts.length > 0 && (
              <div className="bg-white/20 backdrop-blur-md p-6 rounded-xl shadow-lg">
                <h2 className="text-2xl font-bold text-white mb-4">🔔 Price Alerts</h2>
                <div className="space-y-2">
                  {state.alerts.map((alert, index) => (
                    <div 
                      key={index} 
                      className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-lg"
                    >
                      <div className="text-white font-semibold">
                        {alert.symbol} {alert.condition} ${alert.targetPrice}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            
            {/* Subscriptions */}
            <div className="bg-white/20 backdrop-blur-md p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">📝 Subscriptions</h2>
              
              {state.billReminders && state.billReminders.length > 0 ? (
                <div className="space-y-3">
                  {state.billReminders.map((bill, index) => (
                    <div key={index} className="bg-white/10 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-white font-semibold">{bill.name}</div>
                          <div className="text-white/70 text-sm">
                            Due: {bill.dueDay}th
                          </div>
                        </div>
                        <div className="text-white font-bold text-lg">
                          ${bill.amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-white/20">
                    <div className="flex justify-between text-white">
                      <span className="font-semibold">Monthly Total:</span>
                      <span className="font-bold">
                        ${monthlySubscriptions.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/70">
                  <p className="mb-2">No subscriptions tracked</p>
                  <p className="text-sm">Say: "Add Netflix $15 monthly"</p>
                </div>
              )}
            </div>

            {/* Recent Expenses */}
            <div className="bg-white/20 backdrop-blur-md p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">💸 Recent Expenses</h2>
              
              {state.expenses && state.expenses.length > 0 ? (
                <div className="space-y-2">
                  {state.expenses.slice(-5).reverse().map((expense, index) => (
                    <div 
                      key={index} 
                      className="bg-white/10 p-3 rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <div className="text-white font-semibold capitalize">
                          {expense.category}
                        </div>
                        <div className="text-white/70 text-sm">
                          {expense.description}
                        </div>
                        <div className="text-white/60 text-xs">
                          {new Date(expense.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-white font-bold">
                        ${expense.amount.toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-white/20">
                    <div className="flex justify-between text-white">
                      <span className="font-semibold">This Month:</span>
                      <span className="font-bold">
                        ${monthlyExpenses.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-white/70">
                  <p className="mb-2">No expenses tracked</p>
                  <p className="text-sm">Say: "I spent $45 on lunch"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {(!state.portfolio || state.portfolio.length === 0) &&
         (!state.expenses || state.expenses.length === 0) &&
         (!state.billReminders || state.billReminders.length === 0) && (
          <div className="bg-white/20 backdrop-blur-md p-8 rounded-xl shadow-lg text-center mt-6">
            <h2 className="text-2xl font-bold text-white mb-3">
              👋 Welcome to FinanceAI!
            </h2>
            <p className="text-white/80 mb-4">
              Start by asking about stocks or adding to your portfolio
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/70 text-left max-w-2xl mx-auto">
              <div className="bg-white/10 p-3 rounded">
                <div className="font-semibold mb-1">📊 Stock Price</div>
                <div>"What's AAPL price?"</div>
              </div>
              <div className="bg-white/10 p-3 rounded">
                <div className="font-semibold mb-1">💼 Add Stock</div>
                <div>"Add 10 Apple at $271"</div>
              </div>
              <div className="bg-white/10 p-3 rounded">
                <div className="font-semibold mb-1">📈 Portfolio Analysis</div>
                <div>"Analyze my portfolio"</div>
              </div>
              <div className="bg-white/10 p-3 rounded">
                <div className="font-semibold mb-1">🔍 Stock Research</div>
                <div>"Should I buy Tesla?"</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stock Analysis Card
function StockAnalysisCard({ symbol, themeColor, result, status }: any) {
  if (status !== "complete" || !result || !result.currentPrice) {
    return (
      <div 
        className="rounded-xl shadow-xl mt-4 mb-4 max-w-md w-full" 
        style={{ backgroundColor: themeColor }}
      >
        <div className="bg-white/20 p-4 w-full">
          <p className="text-white animate-pulse">
            📊 Analyzing {symbol || 'stock'}...
          </p>
        </div>
      </div>
    );
  }

  const isPositive = (result.changePercent || 0) >= 0;

  return (
    <div 
      style={{ backgroundColor: themeColor }} 
      className="rounded-xl shadow-xl mt-4 mb-4 max-w-md w-full"
    >
      <div className="bg-white/20 p-5 w-full">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-white">{result.symbol}</h3>
            <p className="text-white/80 text-sm">{result.name}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              ${result.currentPrice.toFixed(2)}
            </div>
            {result.change !== undefined && result.changePercent !== undefined && (
              <div className={`text-sm font-semibold ${
                isPositive ? 'text-green-200' : 'text-red-200'
              }`}>
                {isPositive ? '↑' : '↓'} {Math.abs(result.change).toFixed(2)} 
                ({Math.abs(result.changePercent).toFixed(2)}%)
              </div>
            )}
          </div>
        </div>
        {result.marketCap && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/70 text-xs">Market Cap</p>
              <p className="text-white font-semibold text-sm">{result.marketCap}</p>
            </div>
            {result.peRatio && (
              <div>
                <p className="text-white/70 text-xs">P/E Ratio</p>
                <p className="text-white font-semibold text-sm">
                  {result.peRatio.toFixed(2)}
                </p>
              </div>
            )}
            {result.week52High && (
              <div>
                <p className="text-white/70 text-xs">52W High</p>
                <p className="text-white font-semibold text-sm">
                  ${result.week52High.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="bg-white/20 px-3 py-2 rounded-lg">
            <p className="text-white font-semibold text-sm">
              💡 {result.recommendation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stock Research Card
function StockResearchCard({ query, themeColor, result, status }: any) {
  if (status !== "complete" || !result || !result.analysis) {
    return (
      <div 
        className="rounded-xl shadow-xl mt-4 mb-4 max-w-2xl w-full" 
        style={{ backgroundColor: themeColor }}
      >
        <div className="bg-white/20 p-4 w-full">
          <p className="text-white animate-pulse">
            🔍 Researching {query || 'stock'}...
          </p>
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
    <div 
      style={{ backgroundColor: themeColor }} 
      className="rounded-xl shadow-xl mt-4 mb-4 max-w-2xl w-full"
    >
      <div className="bg-white/20 p-5 w-full">
        <div className="mb-4">
          <h3 className="text-2xl font-bold text-white">{result.name}</h3>
          {result.currentPrice && result.currentPrice > 0 && (
            <p className="text-white/80 text-lg">
              ${result.currentPrice.toFixed(2)}
            </p>
          )}
        </div>
        <div className="mb-4">
          <div className={`inline-block px-3 py-1 rounded-full text-white text-sm font-semibold ${
            riskColors[result.riskLevel]
          }`}>
            ⚠️ Risk: {result.riskLevel}
          </div>
        </div>
        {result.pros && result.pros.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-semibold mb-2">✅ PROS</h4>
            <ul className="list-disc list-inside text-white/90 text-sm space-y-1">
              {result.pros.map((pro: string, idx: number) => (
                <li key={idx}>{pro}</li>
              ))}
            </ul>
          </div>
        )}
        {result.cons && result.cons.length > 0 && (
          <div className="mb-4">
            <h4 className="text-white font-semibold mb-2">❌ CONS</h4>
            <ul className="list-disc list-inside text-white/90 text-sm space-y-1">
              {result.cons.map((con: string, idx: number) => (
                <li key={idx}>{con}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-white/20">
          <div className="bg-white/20 p-3 rounded-lg">
            <p className="text-white font-bold mb-1">
              💡 Recommendation: {result.recommendation}
            </p>
            <p className="text-white/90 text-sm">{result.reasoning}</p>
          </div>
        </div>
      </div>
    </div>
  );
}