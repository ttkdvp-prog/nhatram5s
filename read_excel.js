const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'Mau_du_lieu_WebApp_Dashboard_Nha_tram_5S.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=================== SHEET: ${sheetName} ===================`);
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Row Count:', jsonData.length);
  console.log('Headers / First 5 rows:');
  console.log(JSON.stringify(jsonData.slice(0, 8), null, 2));
});
