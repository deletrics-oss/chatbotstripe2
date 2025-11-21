#!/bin/bash

# Chatbot WhatsApp - Deploy Script for Ubuntu 22.04
# This script automates the deployment process

set -e  # Exit on error

echo "================================"
echo "Chatbot WhatsApp - Deploy Script"
echo "================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Please do not run this script as root"
    exit 1
fi

# 1. Check Node.js version
echo "📦 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18 or higher:"
    echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "   sudo apt install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please install Node.js 18 or higher."
    exit 1
fi
echo "✅ Node.js $(node -v) detected"

# 2. Check PostgreSQL
echo "📦 Checking PostgreSQL installation..."
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL not found. Please install PostgreSQL:"
    echo "   sudo apt install -y postgresql postgresql-contrib"
    exit 1
fi
echo "✅ PostgreSQL detected"

# 3. Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env file with your configuration:"
    echo "   nano .env"
    echo ""
    echo "Press Enter when you're done editing .env..."
    read
fi

# 4. Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# 5. Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs

# 6. Build the project
echo "🔨 Building the project..."
npm run build

# 7. Run database migrations
echo "🗄️  Running database migrations..."
if ! npm run db:push; then
    echo "❌ Database migration failed. Check your DATABASE_URL in .env"
    exit 1
fi

# 8. Check if PM2 is installed
echo "📦 Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    echo "⚠️  PM2 not found. Installing PM2 globally..."
    sudo npm install -g pm2
fi
echo "✅ PM2 detected"

# 9. Start/Restart the application with PM2
echo "🚀 Starting application with PM2..."
if pm2 describe chatbot-whatsapp > /dev/null 2>&1; then
    echo "   Restarting existing instance..."
    pm2 restart chatbot-whatsapp
else
    echo "   Starting new instance..."
    pm2 start ecosystem.config.js
fi

# 10. Save PM2 configuration
pm2 save

# 11. Setup PM2 to run on system boot
echo "⚙️  Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

echo ""
echo "================================"
echo "✅ Deployment Complete!"
echo "================================"
echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "📝 Useful Commands:"
echo "   pm2 logs chatbot-whatsapp    # View logs"
echo "   pm2 restart chatbot-whatsapp # Restart app"
echo "   pm2 stop chatbot-whatsapp    # Stop app"
echo "   pm2 monit                    # Monitor app"
echo ""
echo "🌐 Application running on: http://localhost:3035"
echo ""
echo "⚠️  Don't forget to:"
echo "   1. Install Chromium: sudo apt install chromium-browser"
echo "   2. Configure firewall if needed: sudo ufw allow 3035"
echo ""
