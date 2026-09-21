# 🚀 Deployment Guide: Athreya Delivery

This guide covers step-by-step deployment of the Athreya Delivery MERN project:
- **Frontend**: `http://athreyadelivery.com/` (React + Vite SPA)
- **Backend API**: `http://athreyadelivery.com/api` (Node.js + Express)
- **Real-time WebSockets**: `http://athreyadelivery.com/socket.io` (Socket.IO)

---

## 1. Prerequisites on Linux VPS (Ubuntu 20.04 / 22.04 / 24.04)

SSH into your VPS server as `root` or `sudo` user:

```bash
# Update package list
sudo apt update && sudo apt upgrade -y

# Install Node.js (Node 18.x or Node 20.x LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Verify Node and npm
node -v
npm -v

# Install PM2 globally
sudo npm install -g pm2
```

---

## 2. Domain DNS Configuration

Log in to your Domain Registrar (GoDaddy, Namecheap, Cloudflare, Hostinger, etc.) and add **A Records**:

| Type | Name / Host | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `YOUR_SERVER_IP` | Auto / 300s |
| **A** | `www` | `YOUR_SERVER_IP` | Auto / 300s |

---

## 3. Clone / Upload Repository to `/var/www/athreyadelivery`

```bash
# Create directory
sudo mkdir -p /var/www/athreyadelivery
sudo chown -R $USER:$USER /var/www/athreyadelivery

# Clone your repository or copy the project files
git clone <YOUR_GIT_REPO_URL> /var/www/athreyadelivery
# Or transfer via SCP/SFTP into /var/www/athreyadelivery
```

---

## 4. Backend Configuration & Startup

### Step 4.1: Configure Backend `.env`

```bash
cd /var/www/athreyadelivery/backend

# Create production .env file
nano .env
```

Ensure your `.env` contains:
```env
PORT=7000
NODE_ENV=production
PROCESS_ROLE=all
HOSTNAME=athreyadelivery.com
TRUST_PROXY=true

FRONTEND_URL=http://athreyadelivery.com
CORS_ALLOWED_ORIGINS=http://athreyadelivery.com,https://athreyadelivery.com,http://www.athreyadelivery.com,https://www.athreyadelivery.com

MONGO_URI=mongodb+srv://athreyadeliveries25_db_user:17IuOOvgPILGsLSo@cluster0.rq1zlsw.mongodb.net/athreya?retryWrites=true&w=majority&appName=Cluster0

REDIS_DISABLED=true

CLOUDINARY_API_KEY=839946353523777
CLOUDINARY_API_SECRET=pzXIVssxM9nrxCSZ5BbrN3v-qj0
CLOUDINARY_CLOUD_NAME=duh7ros6p

JWT_SECRET=secret123
JWT_EXPIRES_IN=7d

# Include your Firebase, Razorpay/PhonePe, and SMTP settings
```

### Step 4.2: Install Backend Dependencies & Start PM2

```bash
cd /var/www/athreyadelivery/backend
npm ci --only=production

# Start with PM2
pm2 start ecosystem.config.cjs --env production

# Save PM2 state and configure startup on boot
pm2 save
pm2 startup
# (Run the command output by pm2 startup if prompted)
```

---

## 5. Frontend Configuration & Build

### Step 5.1: Configure Frontend `.env.production`

```bash
cd /var/www/athreyadelivery/frontend

# Create production environment file
nano .env.production
```

Ensure `VITE_API_URL` is set:
```env
VITE_API_URL=http://athreyadelivery.com/api
# Or https://athreyadelivery.com/api once SSL is enabled
```

### Step 5.2: Install Dependencies & Build

```bash
cd /var/www/athreyadelivery/frontend
npm ci
npm run build
```

The output will be generated inside `/var/www/athreyadelivery/frontend/dist`.

---

## 6. Nginx Reverse Proxy Setup

Copy the provided Nginx configuration to `/etc/nginx/sites-available/`:

```bash
sudo cp /var/www/athreyadelivery/deployment/nginx-athreyadelivery.conf /etc/nginx/sites-available/athreyadelivery.conf

# Enable the site configuration
sudo ln -s /etc/nginx/sites-available/athreyadelivery.conf /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx syntax
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## 7. Enable Free SSL Certificate (HTTPS) (Recommended)

To enable secure `https://athreyadelivery.com` with Let's Encrypt:

```bash
# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Obtain and configure SSL certificate automatically
sudo certbot --nginx -d athreyadelivery.com -d www.athreyadelivery.com
```

*Certbot will automatically update the Nginx configuration, handle HTTPS redirection, and set up auto-renewal.*

If switching to HTTPS:
1. Update `VITE_API_URL=https://athreyadelivery.com/api` in `frontend/.env.production`
2. Run `npm run build` in `frontend` folder
3. Update `FRONTEND_URL=https://athreyadelivery.com` in `backend/.env`
4. Run `pm2 restart athreya-backend`

---

## 8. Firewall Configuration (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 9. Useful PM2 and Server Commands

| Action | Command |
| :--- | :--- |
| **Check PM2 status** | `pm2 status` |
| **View backend logs** | `pm2 logs athreya-backend` |
| **Restart backend** | `pm2 restart athreya-backend` |
| **Test Nginx config** | `sudo nginx -t` |
| **Reload Nginx** | `sudo systemctl reload nginx` |
| **Automated Redeployment** | `bash /var/www/athreyadelivery/deployment/deploy.sh` |
