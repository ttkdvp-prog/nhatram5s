const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Mau_du_lieu_WebApp_Dashboard_Nha_tram_5S.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('=== ALL SHEETS & HEADERS ===');
workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\nSheet: ${sheetName}`);
  if (jsonData.length > 0) {
    console.log('Header Row 1:', jsonData[0]);
    if (sheetName === 'DANH_MUC' && jsonData.length > 1) {
      console.log('Header Row 2:', jsonData[1]);
    }
  }
});
