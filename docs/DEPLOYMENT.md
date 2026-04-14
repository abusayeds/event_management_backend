# Deployment Guide

## Production Deployment

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Nginx (recommended)
- SSL Certificate

### Environment Setup

1. **Server Preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install Redis
sudo apt install redis-server
```

2. **Database Setup**
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE dawabuyi;
CREATE USER dawabuyi_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE dawabuyi TO dawabuyi_user;
\q
```

3. **Application Setup**
```bash
# Clone repository
git clone <repository-url> /var/www/dawabuyi-backend
cd /var/www/dawabuyi-backend

# Install dependencies
pnpm install --prod

# Set up environment
cp .env.example .env
nano .env  # Edit with production values

# Run migrations
npx prisma migrate deploy

# Build application
npm run build
```

### Process Management with PM2

1. **Install PM2**
```bash
npm install -g pm2
```

2. **Create PM2 Config**
```bash
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'dawabuyi-backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8082
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

3. **Start Application**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx Configuration

1. **Create Nginx Config**
```bash
sudo nano /etc/nginx/sites-available/dawabuyi-backend
```

```nginx
server {
    listen 80;
    server_name api.dawabuyi.com;

    location / {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

2. **Enable Site**
```bash
sudo ln -s /etc/nginx/sites-available/dawabuyi-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### SSL Certificate with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d api.dawabuyi.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Monitoring and Logging

1. **Log Rotation**
```bash
sudo nano /etc/logrotate.d/dawabuyi-backend
```

```
/var/www/dawabuyi-backend/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

2. **Monitoring Script**
```bash
nano scripts/health-check.sh
```

```bash
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/health)
if [ $response != "200" ]; then
    echo "Health check failed. Restarting application..."
    pm2 restart dawabuyi-backend
    # Send alert notification
fi
```

### Backup Strategy

1. **Database Backup**
```bash
# Create backup script
nano scripts/backup-db.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/dawabuyi"
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -h localhost -U dawabuyi_user -d dawabuyi > $BACKUP_DIR/db_backup_$DATE.sql

# Compress old backups (older than 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -exec gzip {} \;

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

2. **Schedule Backups**
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /var/www/dawabuyi-backend/scripts/backup-db.sh

# Health check every 5 minutes
*/5 * * * * /var/www/dawabuyi-backend/scripts/health-check.sh
```

### Security Hardening

1. **Firewall Configuration**
```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow from 127.0.0.1 to any port 8082
```

2. **Application Security**
- Use environment variables for secrets
- Enable CORS for specific domains only
- Implement rate limiting
- Use HTTPS in production
- Regular security updates

### Docker Deployment (Alternative)

1. **Dockerfile**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install --prod

COPY . .
RUN npm run build

EXPOSE 8082

CMD ["npm", "start"]
```

2. **Docker Compose**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8082:8082"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: dawabuyi
      POSTGRES_USER: dawabuyi_user
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Troubleshooting

Common issues and solutions:

1. **Application won't start**
   - Check environment variables
   - Verify database connection
   - Check logs: `pm2 logs dawabuyi-backend`

2. **Database connection failed**
   - Verify PostgreSQL is running
   - Check connection string
   - Ensure user has proper permissions

3. **High memory usage**
   - Monitor with `pm2 monit`
   - Adjust cluster instances
   - Check for memory leaks

4. **Slow response times**
   - Check database queries
   - Monitor Redis performance
   - Enable query logging
