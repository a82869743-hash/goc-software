const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Client Connected. Fetching PM2 logs...');

  conn.exec('tail -n 150 /root/.pm2/logs/goc-backend-out.log; tail -n 150 /root/.pm2/logs/goc-backend-error.log', (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('--- VPS PM2 LOGS ---');
      console.log(output);
      conn.end();
    });
    stream.on('data', data => output += data);
    stream.stderr.on('data', data => output += data);
  });
}).connect({
  host: '72.61.243.180',
  port: 22,
  username: 'root',
  password: 'PremSingh123@',
  readyTimeout: 30000,
});
