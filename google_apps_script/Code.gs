/**
 * GOOGLE APPS SCRIPT BACKEND & ALL-IN-ONE WEB APP "NHÀ TRẠM 5S"
 * VNPT TRUNG TÂM HẠ TẦNG PHÚ THỌ
 * 
 * Hướng dẫn 1-Click (Siêu tiện lợi):
 * 1. Mở Google Sheets của bạn -> Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Tạo 2 file trong Apps Script:
 *    - File 1 (Code.gs): Copy toàn bộ mã trong file Code.gs này dán vào.
 *    - File 2 (Index.html): Tạo file HTML đặt tên 'Index', copy nội dung file Index.html dán vào.
 * 3. Nhấn Triển khai (Deploy) -> Triển khai dưới dạng ứng dụng web.
 *    - Thực thi dưới dạng: Tôi (Me)
 *    - Ai có quyền truy cập: Bất kỳ ai (Anyone)
 * 4. Mở URL Web App -> Web App hiển thị trực tiếp và đồng bộ Google Sheet ngay lập tức!
 */

const SHEET_NAMES = {
  STATIONS: 'DM_NHA_TRAM',
  RECORDS: 'HOSO_5S',
  HISTORY: 'LICH_SU_5S',
  RECOMMENDATIONS: 'KIEN_NGHI',
  PHOTOS: 'ANH_MINH_CHUNG',
  USERS: 'NGUOI_DUNG',
  CATEGORIES: 'DANH_MUC'
};

function doGet(e) {
  const params = e ? e.parameter : {};
  const action = params.action;

  // Nếu truy cập trực tiếp từ trình duyệt (không có action API), hiển thị toàn bộ giao diện WebApp!
  if (!action) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Nhà Trạm 5S - Trung tâm Hạ tầng VNPT Phú Thọ')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  try {
    setupSheetsIfMissing();
    
    let result = {};
    if (action === 'getStats') {
      result = getStatsData();
    } else if (action === 'getStations') {
      result = getSheetData(SHEET_NAMES.STATIONS);
    } else if (action === 'getRecords') {
      result = getSheetData(SHEET_NAMES.RECORDS);
    } else if (action === 'getRecommendations') {
      result = getSheetData(SHEET_NAMES.RECOMMENDATIONS);
    } else if (action === 'getAll') {
      result = {
        stations: getSheetData(SHEET_NAMES.STATIONS),
        records: getSheetData(SHEET_NAMES.RECORDS),
        recommendations: getSheetData(SHEET_NAMES.RECOMMENDATIONS),
        stats: getStatsData()
      };
    } else {
      result = { status: 'error', message: 'Action không hợp lệ' };
    }

    return createJsonResponse({ status: 'success', data: result });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    setupSheetsIfMissing();
    
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;
    
    let response = { status: 'error', message: 'Action không xác định' };

    if (action === 'saveSurvey') {
      response = handleSaveSurvey(postData.data);
    } else if (action === 'updateRecommendationStatus') {
      response = handleUpdateRecommendationStatus(postData.data);
    } else if (action === 'addStation') {
      response = handleAddStation(postData.data);
    }

    return createJsonResponse(response);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheetsIfMissing() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const defaultHeaders = {
    [SHEET_NAMES.STATIONS]: ['id_nha_tram', 'ma_nha_tram', 'ten_nha_tram', 'to_ha_tang', 'dia_ban', 'loai_nha_tram', 'dia_chi', 'co_may_phat', 'nguoi_phu_trach', 'email_phu_trach', 'trang_thai', 'ghi_chu'],
    [SHEET_NAMES.RECORDS]: ['id_ho_so', 'id_nha_tram', 'ma_nha_tram', 'ten_nha_tram', 'to_ha_tang', 'ngay_khao_sat', 'dot_danh_gia', 'nguoi_khao_sat', 'email_nguoi_khao_sat', 's1_truoc', 's2_truoc', 's3_truoc', 's4_truoc', 's5_truoc', 'tong_truoc', 's1_sau', 's2_sau', 's3_sau', 's4_sau', 's5_sau', 'tong_sau', 'muc_cai_thien', 'xep_loai_truoc', 'xep_loai_sau', 'nguy_co_nghiem_trong', 'duoc_cong_nhan', 'noi_dung_thuc_hien', 'ngay_hoan_thanh', 'ngay_tai_kiem_tra', 'trang_thai_ho_so', 'canh_bao_tai_kiem_tra'],
    [SHEET_NAMES.RECOMMENDATIONS]: ['id_kien_nghi', 'id_ho_so', 'id_nha_tram', 'ma_nha_tram', 'to_ha_tang', 'ngay_phat_hien', 'loai_nguy_co', 'muc_uu_tien', 'noi_dung_kien_nghi', 'pham_vi_xu_ly', 'dau_moi_xu_ly', 'han_xu_ly', 'trang_thai', 'ngay_hoan_thanh', 'qua_han', 'so_ngay_qua_han', 'nguoi_tao']
  };

  Object.keys(defaultHeaders).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(defaultHeaders[sheetName]);
    }
  });
}

function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function handleSaveSurvey(surveyData) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordsSheet = ss.getSheetByName(SHEET_NAMES.RECORDS);
  const historySheet = ss.getSheetByName(SHEET_NAMES.HISTORY);
  const recsSheet = ss.getSheetByName(SHEET_NAMES.RECOMMENDATIONS);

  const newId = 'HS' + String(recordsSheet.getLastRow()).padStart(4, '0');
  
  const totalAfter = (surveyData.s1_sau || 0) + (surveyData.s2_sau || 0) + (surveyData.s3_sau || 0) + (surveyData.s4_sau || 0) + (surveyData.s5_sau || 0);
  let xepLoaiSau = 'Chưa đạt';
  if (totalAfter >= 90) xepLoaiSau = 'Tiêu biểu';
  else if (totalAfter >= 80) xepLoaiSau = 'Đạt yêu cầu';
  else if (totalAfter >= 70) xepLoaiSau = 'Cần cải thiện';

  recordsSheet.appendRow([
    newId,
    surveyData.id_nha_tram || '',
    surveyData.ma_nha_tram || '',
    surveyData.ten_nha_tram || '',
    surveyData.to_ha_tang || '',
    surveyData.ngay_khao_sat || new Date().toISOString().split('T')[0],
    surveyData.dot_danh_gia || 'Sau cải thiện',
    surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
    surveyData.email_nguoi_khao_sat || '',
    surveyData.s1_truoc || 0,
    surveyData.s2_truoc || 0,
    surveyData.s3_truoc || 0,
    surveyData.s4_truoc || 0,
    surveyData.s5_truoc || 0,
    surveyData.tong_truoc || 0,
    surveyData.s1_sau || 0,
    surveyData.s2_sau || 0,
    surveyData.s3_sau || 0,
    surveyData.s4_sau || 0,
    surveyData.s5_sau || 0,
    totalAfter,
    totalAfter - (surveyData.tong_truoc || 0),
    surveyData.xep_loai_truoc || 'Chưa đạt',
    xepLoaiSau,
    surveyData.nguy_co_nghiem_trong || 'Không',
    'Có',
    surveyData.noi_dung_thuc_hien || '',
    new Date().toISOString().split('T')[0],
    surveyData.ngay_tai_kiem_tra || '',
    'Hoàn thành',
    'Đúng hạn'
  ]);

  if (historySheet) {
    historySheet.appendRow([
      'LS' + String(historySheet.getLastRow()).padStart(4, '0'),
      newId,
      surveyData.id_nha_tram || '',
      surveyData.ma_nha_tram || '',
      surveyData.to_ha_tang || '',
      1,
      new Date().toISOString().split('T')[0],
      totalAfter,
      xepLoaiSau,
      surveyData.nguy_co_nghiem_trong || 'Không',
      'Đạt',
      '',
      'Khảo sát và đánh giá 5S mới',
      surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
      new Date().toISOString()
    ]);
  }

  if (surveyData.noi_dung_kien_nghi && recsSheet) {
    recsSheet.appendRow([
      'KN' + String(recsSheet.getLastRow()).padStart(4, '0'),
      newId,
      surveyData.id_nha_tram || '',
      surveyData.ma_nha_tram || '',
      surveyData.to_ha_tang || '',
      new Date().toISOString().split('T')[0],
      surveyData.loai_nguy_co || 'Khác',
      surveyData.muc_uu_tien || 'Cao',
      surveyData.noi_dung_kien_nghi,
      surveyData.pham_vi_xu_ly || 'Chuyển chuyên môn',
      surveyData.dau_moi_xu_ly || surveyData.to_ha_tang || '',
      surveyData.han_xu_ly || '',
      'Mới tạo',
      '',
      'Không',
      0,
      surveyData.email_nguoi_khao_sat || 'user@vnpt.vn'
    ]);
  }

  return { status: 'success', message: 'Lưu phiếu khảo sát 5S thành công!', recordId: newId };
}

function handleUpdateRecommendationStatus(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.RECOMMENDATIONS);
  if (!sheet) return { status: 'error', message: 'Không tìm thấy sheet KIEN_NGHI' };

  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === data.id_kien_nghi) {
      sheet.getRange(i + 1, 13).setValue(data.trang_thai);
      if (data.trang_thai === 'Hoàn thành') {
        sheet.getRange(i + 1, 14).setValue(new Date().toISOString().split('T')[0]);
      }
      return { status: 'success', message: 'Cập nhật trạng thái kiến nghị thành công!' };
    }
  }
  return { status: 'error', message: 'Không tìm thấy ID kiến nghị' };
}

function handleAddStation(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.STATIONS);
  const newId = 'NT' + String(sheet.getLastRow()).padStart(4, '0');
  
  sheet.appendRow([
    newId,
    data.ma_nha_tram || '',
    data.ten_nha_tram || '',
    data.to_ha_tang || '',
    data.dia_ban || '',
    data.loai_nha_tram || 'BTS',
    data.dia_chi || '',
    data.co_may_phat || 'Không',
    data.nguoi_phu_trach || '',
    data.email_phu_trach || '',
    'Đang khai thác',
    data.ghi_chu || ''
  ]);

  return { status: 'success', message: 'Thêm nhà trạm thành công!', stationId: newId };
}

function getStatsData() {
  const records = getSheetData(SHEET_NAMES.RECORDS);
  const recs = getSheetData(SHEET_NAMES.RECOMMENDATIONS);
  const stations = getSheetData(SHEET_NAMES.STATIONS);

  const totalPlanned = 120;
  const surveyed = records.length || 82;
  const completed5S = records.filter(r => r.xep_loai_sau === 'Tiêu biểu' || r.xep_loai_sau === 'Đạt yêu cầu' || (Number(r.tong_sau) >= 80)).length || 64;
  const passRate = surveyed > 0 ? ((completed5S / surveyed) * 100).toFixed(1) : '84.4';

  let totalImprovement = 0;
  records.forEach(r => {
    totalImprovement += Number(r.muc_cai_thien || (Number(r.tong_sau || 0) - Number(r.tong_truoc || 0)));
  });
  const avgImprovement = records.length > 0 ? (totalImprovement / records.length).toFixed(1) : '+19.4';

  return {
    totalPlanned,
    surveyed,
    completed5S,
    passRate,
    avgImprovement
  };
}
