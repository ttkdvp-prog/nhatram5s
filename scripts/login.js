import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('=====================================================');
console.log('🔑 ĐĂNG NHẬP GOOGLE CLASP (incuoc@gmail.com)');
console.log('Trình duyệt sẽ mở để cấp quyền...');
console.log('=====================================================\n');

try {
  execSync(`${npxCmd} @google/clasp login`, { stdio: 'inherit', cwd: rootDir });
  console.log('\n✅ ĐĂNG NHẬP CLASP THÀNH CÔNG!');
  console.log('Bây giờ bạn có thể chạy: node scripts/redeploy_appscript.js để đẩy code và redeploy.');
} catch (err) {
  console.error('\n❌ Có lỗi xảy ra trong quá trình đăng nhập:', err.message);
}
