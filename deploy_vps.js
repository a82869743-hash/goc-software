const { Client } = require('ssh2');

const conn = new Client();
const commands = [
  'cd /root/goc-software && git pull origin main',
  "sed -i 's/STUDIO_NAME=Pack Wolf Pvt Ltd/STUDIO_NAME=Packwolf Services Pvt Ltd/' /root/goc-software/.env",
  'echo "---ENV_VERIFY---"',
  'grep STUDIO_NAME /root/goc-software/.env',
  'cd /root/goc-software/backend && npm run build',
  'pm2 restart goc-backend',
  'echo "===DEPLOY_COMPLETE==="'
];

const allCommands = commands.join(' && ');

conn.on('ready', () => {
  console.log('SSH Connected! Running deploy commands...');
  conn.exec(allCommands, (err, stream) => {
    if (err) { console.error('Exec error:', err); conn.end(); return; }
    stream.on('close', (code) => {
      console.log(`\nDeploy finished with exit code: ${code}`);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data.toString());
    }).stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection error:', err.message);
}).connect({
  host: '72.61.243.180',
  port: 22,
  username: 'root',
  password: 'PremSingh123@',
  readyTimeout: 10000,
});
