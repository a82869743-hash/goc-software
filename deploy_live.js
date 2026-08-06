const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

// ─── CONFIG ───────────────────────────────────────────────
const VPS = {
  host: '72.61.243.180',
  port: 22,
  username: 'root',
  password: 'PremSingh123@',
  readyTimeout: 30000,
};
const REMOTE_BASE = '/root/goc-software';
const LOCAL_BASE = __dirname; // project root

// Helper function to recursively collect source files
function getAllFiles(dir, base) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const relPath = path.join(base, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git' && file !== '.vite') {
        results = results.concat(getAllFiles(fullPath, relPath));
      }
    } else {
      results.push(relPath.replace(/\\/g, '/'));
    }
  });
  return results;
}

// Dynamically generate complete list of files to upload
const FILES_TO_UPLOAD = [
  ...getAllFiles(path.join(LOCAL_BASE, 'frontend/src'), 'frontend/src'),
  ...getAllFiles(path.join(LOCAL_BASE, 'backend/src'), 'backend/src'),
  ...getAllFiles(path.join(LOCAL_BASE, 'database/migrations'), 'database/migrations'),
  'backend/server.ts',
  'backend/package.json',
  'frontend/package.json',
  'frontend/index.html',
  'frontend/vite.config.ts',
  '.env.example',
  '.env',
];

// ─── SFTP UPLOAD ──────────────────────────────────────────
function uploadFiles(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);

      let uploaded = 0;
      const total = FILES_TO_UPLOAD.length;

      // Ensure remote directories exist via mkdir -p first
      const dirs = [...new Set(FILES_TO_UPLOAD.map(f => path.dirname(f)))];
      const mkdirCmd = dirs.map(d => `mkdir -p ${REMOTE_BASE}/${d.replace(/\\/g, '/')}`).join(' && ');

      conn.exec(mkdirCmd, (err2, stream) => {
        if (err2) return reject(err2);
        stream.on('close', () => {
          // Now upload each file
          FILES_TO_UPLOAD.forEach(relPath => {
            const localPath = path.join(LOCAL_BASE, relPath);
            const remotePath = `${REMOTE_BASE}/${relPath.replace(/\\/g, '/')}`;

            if (!fs.existsSync(localPath)) {
              console.log(`  ⚠ SKIP (not found): ${relPath}`);
              uploaded++;
              if (uploaded === total) resolve();
              return;
            }

            const readStream = fs.createReadStream(localPath);
            const writeStream = sftp.createWriteStream(remotePath);

            writeStream.on('close', () => {
              uploaded++;
              console.log(`  ✅ [${uploaded}/${total}] ${relPath}`);
              if (uploaded === total) resolve();
            });

            writeStream.on('error', (uploadErr) => {
              console.error(`  ❌ FAIL: ${relPath} — ${uploadErr.message}`);
              uploaded++;
              if (uploaded === total) resolve();
            });

            readStream.pipe(writeStream);
          });
        });
        stream.on('data', () => {});
        stream.stderr.on('data', () => {});
      });
    });
  });
}

// ─── REMOTE BUILD & RESTART ───────────────────────────────
function runRemoteCommands(conn) {
  return new Promise((resolve, reject) => {
    const commands = [
      `mysql -u root goc_studio -e "ALTER TABLE meta_integration_settings ADD COLUMN page_id VARCHAR(255) NULL AFTER app_secret;" 2>&1 || true`,
      `echo "=== [1/4] Installing backend deps ==="`,
      `cd ${REMOTE_BASE}/backend && npm install --production=false 2>&1`,
      `echo "=== [2/4] Building backend ==="`,
      `cd ${REMOTE_BASE}/backend && npm run build 2>&1`,
      `echo "=== [3/4] Building frontend ==="`,
      `cd ${REMOTE_BASE}/frontend && npm install --production=false 2>&1 && npm run build 2>&1 && rm -rf /var/www/goc-studio/* && cp -r ${REMOTE_BASE}/frontend/dist/* /var/www/goc-studio/ && (nginx -s reload 2>&1 || systemctl reload nginx 2>&1 || true)`,
      `cp ${REMOTE_BASE}/.env ${REMOTE_BASE}/backend/.env 2>&1 || true`,
      `echo "=== [4/4] Restarting PM2 with updated env ==="`,
      `pm2 restart goc-backend --update-env 2>&1`,
      `echo "=== DEPLOY COMPLETE ==="`,
      `pm2 status 2>&1`,
    ].join(' && ');

    conn.exec(commands, (err, stream) => {
      if (err) return reject(err);
      let output = '';
      stream.on('close', (code) => {
        console.log(`\n--- Remote commands exited with code: ${code} ---`);
        resolve(output);
      });
      stream.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stdout.write(text);
      });
      stream.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        process.stderr.write(text);
      });
    });
  });
}

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
  const conn = new Client();

  conn.on('error', (err) => {
    console.error('❌ SSH Connection error:', err.message);
    process.exit(1);
  });

  conn.on('ready', async () => {
    try {
      console.log('🔗 SSH Connected to VPS!\n');

      console.log('📦 Uploading modified files...');
      await uploadFiles(conn);

      console.log('\n🔨 Running remote build & restart...\n');
      await runRemoteCommands(conn);

      console.log('\n✅ ALL DONE — Live server updated!');
    } catch (err) {
      console.error('❌ Deploy error:', err);
    } finally {
      conn.end();
    }
  });

  conn.connect(VPS);
}

main();
