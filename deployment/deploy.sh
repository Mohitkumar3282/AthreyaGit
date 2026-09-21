#!/bin/bash
# ==============================================================================
# Athreya Delivery Deployment Script for Ubuntu / Debian VPS
# ==============================================================================

set -e

APP_DIR="/var/www/athreyadelivery"

echo "=========================================="
echo "🚀 Starting Deployment for athreyadelivery.com"
echo "=========================================="

# 1. Ensure directory exists
cd "$APP_DIR"

# 2. Pull latest code (if using git on server)
if [ -d ".git" ]; then
  echo "📥 Pulling latest git changes..."
  git pull origin main
fi

# 3. Setup and Build Backend
echo "📦 Installing Backend dependencies..."
cd "$APP_DIR/backend"
npm ci --only=production

# 4. Restart Backend with PM2
echo "🔄 Reloading PM2 backend process..."
if pm2 describe athreya-backend > /dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --env production
else
    pm2 start ecosystem.config.cjs --env production
fi
pm2 save

# 5. Setup and Build Frontend
echo "📦 Installing Frontend dependencies..."
cd "$APP_DIR/frontend"
npm ci

echo "🏗️ Building Frontend for production..."
npm run build

# 6. Set correct permissions for Nginx
echo "🔒 Setting permissions for /var/www/athreyadelivery..."
sudo chown -R www-data:www-data "$APP_DIR/frontend/dist"
sudo chmod -R 755 "$APP_DIR/frontend/dist"

# 7. Test and Reload Nginx
echo "🌐 Testing and reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "   Frontend: http://athreyadelivery.com/"
echo "   Backend:  http://athreyadelivery.com/api"
echo "=========================================="
