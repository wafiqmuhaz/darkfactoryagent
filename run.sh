#!/bin/bash

# Dark Factory - Quick Start Script

set -e

echo "🏭 Starting Dark Factory..."

if [ "$1" == "--local" ]; then
  echo "🚀 Running in local development mode..."
  
  echo "📦 Installing backend dependencies..."
  cd backend && npm install
  
  echo "📦 Installing frontend dependencies..."
  cd ../frontend && npm install
  
  echo "🗄️ Starting local Redis container..."
  docker run -d --name dark-factory-redis -p 6379:6379 redis:7-alpine || echo "Redis already running"
  
  echo "🏃‍♂️ Starting development servers..."
  echo "Please run these commands in separate terminals:"
  echo "1. cd backend && npm run dev"
  echo "2. cd frontend && npm run dev"
  
else
  echo "🐳 Running in Docker Compose mode..."
  docker-compose up -d --build
  
  echo "✅ Dark Factory is now running!"
  echo "Frontend: http://localhost:3000"
  echo "Backend API: http://localhost:3001"
fi
