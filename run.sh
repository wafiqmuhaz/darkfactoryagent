#!/bin/bash

# Dark Factory - Quick Start Script (Paperclip.ai Aligned)

set -e

echo "🏭 Starting Dark Factory..."
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           DARK FACTORY — AI AGENT SYSTEM                    ║"
echo "║       Paperclip.ai-aligned mission-driven workflow          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─── Check Dependencies ──────────────────────────────────────────

check_claude() {
  if command -v claude &> /dev/null; then
    local version
    version=$(claude --version 2>/dev/null || echo "unknown")
    echo "  ✅ Claude Code CLI found: $(which claude) (v$version)"
    return 0
  else
    echo "  ⚠️  Claude Code CLI not found"
    echo "     Install: npm i -g @anthropic-ai/claude-code"
    return 1
  fi
}

check_codex() {
  if command -v codex &> /dev/null; then
    local version
    version=$(codex --version 2>/dev/null || echo "unknown")
    echo "  ✅ Codex CLI found: $(which codex) (v$version)"
    return 0
  else
    echo "  ⚠️  Codex CLI not found"
    echo "     Install: npm i -g @openai/codex"
    return 1
  fi
}

check_node() {
  if command -v node &> /dev/null; then
    echo "  ✅ Node.js found: $(node --version)"
    return 0
  else
    echo "  ❌ Node.js not found. Please install Node.js 18+"
    exit 1
  fi
}

check_docker() {
  if command -v docker &> /dev/null; then
    echo "  ✅ Docker found: $(docker --version)"
    return 0
  else
    echo "  ⚠️  Docker not found (optional for local mode)"
    return 1
  fi
}

echo "📋 Checking dependencies..."
echo ""
check_node
echo ""
check_claude
check_codex
echo ""

# ─── Mode Selection ──────────────────────────────────────────────

if [ "$1" == "--local" ]; then
  echo "🚀 Running in local development mode..."
  echo ""

  # Install dependencies
  echo "📦 Installing backend dependencies..."
  cd backend && npm install

  echo "📦 Installing frontend dependencies..."
  cd ../frontend && npm install
  cd ..

  # Start Redis if Docker is available
  if command -v docker &> /dev/null; then
    if ! docker ps --format '{{.Names}}' | grep -q "^dark-factory-redis$"; then
      echo "🗄️  Starting local Redis container..."
      docker run -d --name dark-factory-redis -p 6379:6379 redis:7-alpine 2>/dev/null || echo "Redis already running"
    else
      echo "🗄️  Redis container already running"
    fi
    echo ""
  else
    echo "⚠️  Docker not found. Redis must be running separately for queue processing."
    echo "   Install Redis: brew install redis && brew services start redis"
    echo ""
    echo "   If Redis is unavailable, the system will fallback to in-memory queue."
    echo ""
  fi

  # Generate Prisma client and run migrations
  echo "🗄️  Setting up database..."
  cd backend
  npx prisma generate 2>/dev/null || echo "Prisma generate skipped (will run on first dev start)"
  cd ..

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ✅ Setup complete! Start development servers:              ║"
  echo "║                                                             ║"
  echo "║  Terminal 1: cd backend && npm run dev                      ║"
  echo "║  Terminal 2: cd frontend && npm run dev                     ║"
  echo "║                                                             ║"
  echo "║  Frontend: http://localhost:5173                            ║"
  echo "║  Backend:  http://localhost:3001                            ║"
  echo "╚══════════════════════════════════════════════════════════════╝"

else
  echo "🐳 Running in Docker Compose mode..."
  echo ""

  # Check for adapters
  echo "🔌 Checking adapter CLIs for container usage..."
  check_claude
  check_codex
  echo ""

  docker-compose up -d --build

  echo ""
  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  ✅ Dark Factory is now running!                            ║"
  echo "║                                                             ║"
  echo "║  Frontend: http://localhost:3000                            ║"
  echo "║  Backend API: http://localhost:3001                         ║"
  echo "║  Redis:     localhost:6379                                  ║"
  echo "║                                                             ║"
  echo "║  📋 First-time setup:                                       ║"
  echo "║   1. Open http://localhost:3000                             ║"
  echo "║   2. Register an account                                   ║"
  echo "║   3. Complete the onboarding wizard:                       ║"
  echo "║      → Build a New Company                                 ║"
  echo "║      → Define Your Mission                                 ║"
  echo "║      → Create Team Lead                                    ║"
  echo "║      → Connect a Model (Test adapters)                     ║"
  echo "║      → Review & Get Started                                ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
fi
