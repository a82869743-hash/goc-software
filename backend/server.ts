import app from './src/app';
import dotenv from 'dotenv';
import path from 'path';
import { validateMetaTokenArchitectureOnStartup } from './src/services/metaLeadService';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = parseInt(process.env.PORT || '4000', 10);

app.listen(PORT, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         GOC Studio Management System v2.0       ║');
  console.log('║              Backend API Server                 ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  🚀 Server running on port ${PORT}                 ║`);
  console.log(`║  📡 API Base: http://localhost:${PORT}/api/v1       ║`);
  console.log(`║  🏥 Health:   http://localhost:${PORT}/api/health   ║`);
  console.log(`║  🔧 Mode:     ${(process.env.NODE_ENV || 'development').padEnd(33)}║`);
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  // Validate Meta Page Access Token Architecture
  await validateMetaTokenArchitectureOnStartup();
});
