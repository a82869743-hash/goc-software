const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('cat /etc/nginx/sites-enabled/goc-studio', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
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
  readyTimeout: 30000
});
