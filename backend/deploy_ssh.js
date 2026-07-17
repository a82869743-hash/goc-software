const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  // We'll run a shell or multiple commands
  conn.exec('find / -name "goc-software" -type d 2>/dev/null || find / -name "goc-software-main" -type d 2>/dev/null', (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('Find finished. Code: ' + code);
      const paths = output.trim().split('\n').filter(Boolean);
      console.log('Found paths:', paths);
      if (paths.length > 0) {
        runDeployment(paths[0]);
      } else {
        console.log('Could not find project directory. Trying common locations...');
        runDeployment('/root/goc-software-main'); // Fallback guess
      }
    }).on('data', (data) => {
      output += data;
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect({
  host: '72.61.243.180',
  port: 22,
  username: 'root',
  password: 'PremSingh123@',
  readyTimeout: 30000
});

function runDeployment(projectPath) {
  console.log('Using project path:', projectPath);
  
  // Let's run deployment commands
  // 1. git pull
  // 2. check Nginx configuration
  // 3. restart backend/frontend
  const cmd = `
    echo "=== Current Dir ==="
    pwd
    cd ${projectPath} || cd /var/www/goc-software || cd /root/goc-software
    echo "=== Git Pull ==="
    git fetch --all
    git reset --hard origin/main
    
    echo "=== Checking PM2 / Services ==="
    pm2 status || systemctl status goc-backend || echo "No pm2/systemd found"

    echo "=== Nginx Config Search ==="
    find /etc/nginx -type f -name "*goc*" -o -name "default" -o -name "*studio*"
    
    echo "=== View Nginx active configs ==="
    cat /etc/nginx/sites-enabled/* | grep -A 10 -B 10 "proxy_pass" || cat /etc/nginx/nginx.conf | grep -A 10 -B 10 "proxy_pass"
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
}
