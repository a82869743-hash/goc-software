const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  
  const cmd = `
    set -e
    echo "=== 1. Pulling latest code ==="
    cd /root/goc-software
    git fetch --all
    git reset --hard origin/main

    echo "=== 2. Building Backend ==="
    cd /root/goc-software/backend
    npm install
    npm run build

    echo "=== 3. Building Frontend ==="
    cd /root/goc-software/frontend
    npm install
    npm run build
    
    echo "=== 4. Updating Frontend deployment directory ==="
    mkdir -p /var/www/goc-studio
    rm -rf /var/www/goc-studio/*
    cp -r dist/* /var/www/goc-studio/
    
    echo "=== 5. Restarting Backend Server ==="
    pm2 restart goc-backend || pm2 start dist/server.js --name "goc-backend"

    echo "=== 6. Updating Nginx Configuration ==="
    # Backup nginx config
    cp /etc/nginx/sites-enabled/goc-studio /etc/nginx/sites-enabled/goc-studio.bak
    
    # Write a new nginx config with correct uploads mapping
    cat << 'EOF' > /etc/nginx/sites-enabled/goc-studio
server {
    server_name godofceramic.cloud www.godofceramic.cloud 72.61.243.180;

    root /var/www/goc-studio;
    index index.html;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Do not cache index.html to force browser to load new JS bundles immediately
    location = /index.html {
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        expires -1;
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    # Uploads - Proxy to backend to bypass permission issues with /root/ folder
    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/godofceramic.cloud/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/godofceramic.cloud/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.godofceramic.cloud) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = godofceramic.cloud) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80 default_server;
    listen [::]:80 default_server;
    server_name godofceramic.cloud www.godofceramic.cloud 72.61.243.180;
    return 404; # managed by Certbot
}
EOF

    echo "=== 7. Verifying Nginx and reloading ==="
    nginx -t
    systemctl reload nginx
    echo "=== Deployment Successful! ==="
  `;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '72.61.243.180',
  port: 22,
  username: 'root',
  password: 'PremSingh123@',
  readyTimeout: 60000
});
