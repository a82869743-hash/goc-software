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

    echo "=== 3. Restarting Backend Server ==="
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
  readyTimeout: 60000
});
