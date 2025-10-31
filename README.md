# FinanceAI - AI-Powered Stock Research & Portfolio Management Agent

**Nosana Builders Challenge #3 Submission**

[Video Link](https://www.loom.com/share/e14861d88be0422eb3dc77fbd697f242)

## 🎯 Project Overview

FinanceAI is an intelligent AI agent that helps users make informed investment decisions through comprehensive stock research, real-time portfolio analysis, and automated financial tracking. Built with Mastra framework and deployed on Nosana's decentralized network.

### What It Does

FinanceAI serves as your personal financial analyst, providing:
- **Real-time stock research** with market data, news, and analysis
- **Portfolio management** with profit/loss tracking and live price updates
- **Investment recommendations** based on diversification and risk analysis
- **Price alerts** with email notifications
- **Expense and subscription tracking** for complete financial overview
- **IPO research** for new investment opportunities

## ✨ Key Features

### Stock Research & Analysis
- 📊 Real-time stock quotes with P/E ratios, market cap, and 52-week highs
- 🔍 Deep investment research with pros/cons analysis and risk assessment
- 📰 Latest market news and stock-specific news
- 🆚 Side-by-side stock comparisons
- 🎯 IPO research with calendar and investment analysis

### Portfolio Management
- 💼 Track multiple holdings with purchase price and quantity
- 📈 Live portfolio valuation with auto-refresh (30s intervals)
- 💰 Real-time profit/loss calculations with percentage gains
- 📊 Portfolio analysis with diversification and risk scores
- 🎯 AI-powered investment recommendations
- 📂 CSV bulk import for easy portfolio setup

### Smart Alerts & Notifications
- 🔔 Set price alerts (above/below target prices)
- 📧 Email notifications when alerts trigger
- ⚡ Instant notifications for portfolio events

### Financial Tracking
- 💸 Expense tracking by category
- 📝 Subscription management with monthly totals
- 📅 Automated monthly summaries

## 🛠️ Technology Stack

- **Agent Framework**: Mastra.ai
- **Frontend**: Next.js 14, React, TypeScript
- **UI Library**: CopilotKit for AI chat interface
- **Styling**: TailwindCSS with custom luxury theme
- **LLM**: Qwen3:8b (via Nosana/Ollama)
- **APIs**: 
  - Finnhub API (stock data)
  - NewsAPI (market news)
  - Nodemailer (email notifications)
- **Database**: LibSQL for persistent storage
- **Deployment**: Docker + Nosana Network

## 🚀 Live Demo

**Deployed on Nosana Network**
- Demo Video: [Video Link](https://www.loom.com/share/e14861d88be0422eb3dc77fbd697f242)
- Docker Image: `pranav1100/financeai:latest`
- Live URL: [Nosana Deployment URL](#)


## 🎮 How to Use

### Quick Start Commands

1. **Get Stock Quotes**
   - "What's AAPL price?"
   - "Show me Tesla stock info"

2. **Research Investments**
   - "Should I buy Tesla?"
   - "Compare Apple vs Microsoft"
   - "Tell me about Lenskart IPO"

3. **Manage Portfolio**
   - "Add 10 shares of Apple at $271"
   - "Analyze my portfolio"
   - "What should I do in my portfolio?"
   - "Which stocks should I sell?"

4. **Set Alerts**
   - "Alert me if Apple drops below $160"
   - "Notify me when Tesla goes above $500"

5. **Track Finances**
   - "I spent $45 on lunch"
   - "Add Netflix subscription $15 monthly"
   - "Show my expenses"

## 💻 Local Development Setup

### Prerequisites

- Node.js 18+ and pnpm
- Docker (for deployment)
- API Keys (see Environment Variables below)

### Installation

```bash
# Clone the repository
git clone https://github.com/pranav-1100/agent-challenge
cd agent-challenge

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development servers
pnpm run dev:ui      # Frontend (localhost:3000)
pnpm run dev:agent   # Agent server (localhost:4111)
```

### Environment Variables

Create a `.env` file with the following:

```env
# LLM Configuration (Choose one)
# Option 1: Nosana Endpoint (Recommended)
OLLAMA_API_URL=https://3yt39qx97wc9hqwwmylrphi4jsxrngjzxnjakkybnxbw.node.k8s.prd.nos.ci/api
MODEL_NAME_AT_ENDPOINT=qwen3:8b

# Option 2: Local Ollama
# OLLAMA_API_URL=http://127.0.0.1:11434/api
# MODEL_NAME_AT_ENDPOINT=qwen3:8b

# API Keys (Required)
NEXT_PUBLIC_FINNHUB_API_KEY=your_finnhub_api_key
FINNHUB_API_KEY=your_finnhub_api_key

# Optional: News and Email
NEXT_PUBLIC_NEWS_API_KEY=your_newsapi_key
NEWS_API_KEY=your_newsapi_key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
```

### Get API Keys

- **Finnhub**: Free at [finnhub.io](https://finnhub.io) (Required)
- **NewsAPI**: Free at [newsapi.org](https://newsapi.org) (Optional)
- **Gmail App Password**: [Generate here](https://myaccount.google.com/apppasswords) (Optional)

## 🐳 Docker Deployment

### Build and Test Locally

```bash
# Build Docker image
docker build -t yourusername/financeai:latest .

# Test locally
docker run -p 3000:3000 \
  -e OLLAMA_API_URL=your_url \
  -e FINNHUB_API_KEY=your_key \
  yourusername/financeai:latest

# Push to Docker Hub
docker login
docker push yourusername/financeai:latest
```

### Deploy to Nosana

1. **Via Nosana Dashboard**:
   - Go to [dashboard.nosana.com/deploy](https://dashboard.nosana.com/deploy)
   - Edit `nos_job_def/nosana_mastra.json` with your image name
   - Select GPU and deploy

2. **Via Nosana CLI**:
```bash
npm install -g @nosana/cli
nosana job post --file ./nos_job_def/nosana_mastra.json --market nvidia-3090 --timeout 30
```

## 🏗️ Architecture

### Agent Tools

FinanceAI uses 13 custom tools:

1. **stockAnalyzerTool** - Real-time stock quotes and metrics
2. **smartStockResearchTool** - Deep investment research with pros/cons
3. **portfolioProfitCalculatorTool** - Calculate portfolio P&L
4. **portfolioAdvisorTool** - AI portfolio analysis and recommendations
5. **ipoResearchTool** - IPO calendar and research
6. **alertCheckerTool** - Monitor and trigger price alerts
7. **emailNotificationTool** - Send email notifications
8. **expenseTrackerTool** - Track expenses
9. **csvImporterTool** - Bulk import portfolios
10. **rebalancingAnalyzerTool** - Portfolio rebalancing suggestions
11. **benchmarkComparisonTool** - Compare vs S&P 500
12. **portfolioManagerTool** - Manage holdings
13. **smartAlertsTool** - Manage price alerts

### Data Flow

```
User Input → CopilotKit UI → Mastra Agent → Tools → External APIs
                                    ↓
                            Working Memory (LibSQL)
                                    ↓
                            Response → Frontend Display
```

## 🎯 Innovation Highlights

1. **Comprehensive Financial Management** - Combines stock research, portfolio tracking, and personal finance in one agent
2. **Real-time Updates** - Live price tracking with 30-second auto-refresh
3. **Intelligent Recommendations** - AI-powered portfolio analysis with actionable insights
4. **Multi-source Data** - Integrates Finnhub, NewsAPI, and email for complete financial picture
5. **User-Friendly Interface** - Luxury-themed UI with intuitive chat-based interaction
6. **Persistent Memory** - Remembers your portfolio, alerts, and preferences across sessions

## 📊 Use Cases

- **Individual Investors**: Research stocks and manage portfolio
- **Day Traders**: Track multiple holdings with real-time prices
- **Long-term Investors**: Monitor portfolio health and diversification
- **Financial Planners**: Track client portfolios and expenses
- **Students**: Learn about investing with real market data

## 🔒 Security & Privacy

- Email addresses stored only in working memory
- No sensitive financial data leaves your session
- API keys managed via environment variables
- All portfolio data stored locally in LibSQL


## 🤝 Contributing

While this is a challenge submission, feedback and suggestions are welcome! Open an issue or reach out on Discord.

## 👨‍💻 Author

**Your Name**
- GitHub: [@pranav-1100](https://github.com/pranav-1100)
- Twitter: [@pranavbuilds_](https://x.com/pranavbuilds_)
- Email: pranavaggarwal1100@gmail.com

##  Acknowledgments

- **Nosana** for providing decentralized compute infrastructure
- **Mastra** for the powerful agent framework
- **CopilotKit** for the seamless chat UI
- **Finnhub** for comprehensive stock market data
- **Nosana Community** for support and feedback