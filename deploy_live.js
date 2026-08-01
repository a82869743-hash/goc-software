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

// All files that were changed in this update
const FILES_TO_UPLOAD = [
  // Backend controllers
  'backend/src/controllers/commissionController.ts',
  'backend/src/controllers/inventoryController.ts',
  'backend/src/controllers/jobCardController.ts',
  'backend/src/controllers/staffController.ts',
  'backend/src/controllers/staffPermissionsController.ts',
  // Backend routes
  'backend/src/routes/commissions.ts',
  'backend/src/routes/customers.ts',
  'backend/src/routes/inventory.ts',
  'backend/src/routes/invoices.ts',
  'backend/src/routes/leads.ts',
  'backend/src/routes/marketing.ts',
  'backend/src/routes/quotations.ts',
  'backend/src/routes/recycleBin.ts',
  'backend/src/routes/staff.ts',
  'backend/src/routes/vehicles.ts',
  // Backend utils
  'backend/src/utils/db.ts',
  // Frontend API
  'frontend/src/api/commissions.ts',
  'frontend/src/api/staff.ts',
  // Frontend pages
  'frontend/src/pages/CommissionsPage.tsx',
  'frontend/src/pages/InventoryPage.tsx',
  'frontend/src/pages/JobCardDetailPage.tsx',
  'frontend/src/pages/QuotationsPage.tsx',
  'frontend/src/pages/RecycleBinPage.tsx',
  'frontend/src/pages/StaffDetailPage.tsx',
  // Frontend utils
  'frontend/src/utils/usePermissions.ts',
  // Database migration
  'database/migrations/008_add_staff_profile_picture.sql',
  // Config
  '.env.example',
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
      `echo "=== [1/4] Installing backend deps ==="`,
      `cd ${REMOTE_BASE}/backend && npm install --production=false 2>&1`,
      `echo "=== [2/4] Building backend ==="`,
      `cd ${REMOTE_BASE}/backend && npm run build 2>&1`,
      `echo "=== [3/4] Building frontend ==="`,
      `cd ${REMOTE_BASE}/frontend && npm install --production=false 2>&1 && npm run build 2>&1`,
      `echo "=== [4/4] Restarting PM2 ==="`,
      `pm2 restart goc-backend 2>&1`,
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
