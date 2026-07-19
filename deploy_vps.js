const { Client } = require('ssh2');

const conn = new Client();
const commands = [
  'grep -i "STUDIO_NAME" /root/goc-software/.env',
  'echo "---PDF_SERVICE_CHECK---"',
  'grep -in "pack wolf\\|Pack Wolf\\|PACK WOLF" /root/goc-software/backend/src/services/pdfService.ts || echo "NO_PACK_WOLF_IN_SOURCE"',
  'echo "---BUILT_JS_CHECK---"',
  'grep -rn "Pack Wolf" /root/goc-software/backend/dist/services/pdfService.js 2>/dev/null || echo "NO_PACK_WOLF_IN_DIST"',
  'echo "---ENV_FULL---"',
  'grep -i "STUDIO" /root/goc-software/.env'
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
