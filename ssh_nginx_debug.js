const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Client Ready');
  // Check latest Nginx error logs
  const command = 'tail -n 10 /var/log/nginx/error.log';
  
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('--- NEW NGINX ERROR LOGS ---');
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
  readyTimeout: 15000,
});
