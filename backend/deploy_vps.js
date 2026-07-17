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
    npm run build

    echo "=== 3. Building Frontend ==="
    cd /root/goc-software/frontend
    npm run build
    
    echo "=== 4. Updating Frontend deployment directory ==="
    mkdir -p /var/www/goc-studio
    rm -rf /var/www/goc-studio/*
    cp -r dist/* /var/www/goc-studio/

    echo "=== 5. Restarting Backend Server ==="
    pm2 restart goc-backend
    echo "=== Deployment Successful! ==="
  `;
  
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Deploy finished with code: ' + code);
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
  readyTimeout: 90000
});
