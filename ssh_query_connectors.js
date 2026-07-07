const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH Client Ready');
  // Query connectors table
  const command = 'mysql -u root -p1234 -e "SELECT * FROM connectors;" goc_studio 2>&1';
  
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    let output = '';
    stream.on('close', (code, signal) => {
      console.log('--- VPS DB CONNECTORS RESULT ---');
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
