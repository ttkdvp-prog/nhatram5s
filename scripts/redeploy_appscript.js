import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Đọc Deployment ID từ file .env
const envPath = path.join(rootDir, '.env');
let deploymentId = 'AKfycbyJd-UnQaqPj3xhMx-FVybu5deYI0VXtqgpQPiWcytJPxcw81Goy7raBlIGLZ3BSmdP_A';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/VITE_APPSCRIPT_URL=.*\/s\/([a-zA-Z0-9_-]+)\/exec/);
  if (match && match[1]) {
    deploymentId = match[1];
  }
}

console.log('=====================================================');
console.log('🚀 TỰ ĐỘNG ĐẨY CODE VÀ REDEPLOY APPS SCRIPT');
console.log(`📌 Script ID:     10xx2_AYEPl_APEnqtxCBbnHXag279e6fh5j0pIF3CH1MQVFdtEx00nEB`);
console.log(`📌 Deployment ID: ${deploymentId}`);
console.log('=====================================================\n');

try {
  // 1. Đẩy code lên Google Apps Script
  console.log('⏳ Bước 1: Đang đẩy code mới nhất (Code.gs, appsscript.json)...');
  execSync(`${npxCmd} @google/clasp push -f`, { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Đẩy code lên Apps Script thành công!\n');

  // 2. Tạo Version mới và redeploy vào đúng Deployment ID cũ để GIỮ NGUYÊN URL
  console.log(`⏳ Bước 2: Đang cập nhật bản triển khai giữ nguyên URL (${deploymentId})...`);
  const deployDesc = `Auto-deploy 5S VNPT - ${new Date().toLocaleString('vi-VN')}`;
  
  execSync(`${npxCmd} @google/clasp deploy -i "${deploymentId}" -d "${deployDesc}"`, {
    stdio: 'inherit',
    cwd: rootDir
  });

  console.log('\n=====================================================');
  console.log('🎉 TRIỂN KHAI THÀNH CÔNG VÀ GIỮ NGUYÊN 100% URL!');
  console.log(`🔗 Web App URL: https://script.google.com/macros/s/${deploymentId}/exec`);
  console.log('=====================================================\n');
} catch (error) {
  console.error('\n❌ Lỗi khi thực thi clasp:');
  console.error('Nếu bạn chưa đăng nhập tài khoản incuoc@gmail.com, vui lòng chạy lệnh:');
  console.error('👉 npx.cmd @google/clasp login\n');
  process.exit(1);
}
