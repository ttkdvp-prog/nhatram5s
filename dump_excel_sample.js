const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Mau_du_lieu_WebApp_Dashboard_Nha_tram_5S.xlsx');
const workbook = XLSX.readFile(filePath);

const data = {};
workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  data[sheetName] = XLSX.utils.sheet_to_json(sheet);
});

console.log('--- DM_NHA_TRAM Sample (2 rows) ---');
console.log(JSON.stringify(data['DM_NHA_TRAM']?.slice(0, 2), null, 2));

console.log('--- HOSO_5S Sample (2 rows) ---');
console.log(JSON.stringify(data['HOSO_5S']?.slice(0, 2), null, 2));

console.log('--- LICH_SU_5S Sample (2 rows) ---');
console.log(JSON.stringify(data['LICH_SU_5S']?.slice(0, 2), null, 2));

console.log('--- KIEN_NGHI Sample (2 rows) ---');
console.log(JSON.stringify(data['KIEN_NGHI']?.slice(0, 2), null, 2));

console.log('--- ANH_MINH_CHUNG Sample (2 rows) ---');
console.log(JSON.stringify(data['ANH_MINH_CHUNG']?.slice(0, 2), null, 2));

console.log('--- NGUOI_DUNG Sample (2 rows) ---');
console.log(JSON.stringify(data['NGUOI_DUNG']?.slice(0, 2), null, 2));
