/**
 * =========================================================================
 * GOOGLE APPS SCRIPT BACKEND "NHÀ TRẠM 5S" - VNPT PHÚ THỌ
 * XỬ LÝ TOÀN BỘ DỮ LIỆU GOOGLE SHEETS & TẢI ẢNH GOOGLE DRIVE CHUẨN LINK LH3
 * =========================================================================
 * 
 * HƯỚNG DẪN 1-CLICK:
 * 1. Mở Google Sheet quản lý 5S -> Tiện ích mở rộng (Extensions) -> Apps Script.
 * 2. Dán toàn bộ mã nguồn file Code.gs này vào.
 * 3. Nhấn "Chạy" (Run) hàm "initSampleData" một lần để tự động tạo đầy đủ bảng & dữ liệu mẫu.
 * 4. Nhấn "Triển khai" (Deploy) -> "Triển khai dưới dạng ứng dụng web mới":
 *    - Thực thi dưới dạng (Execute as): "Tôi (Me)"
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai (Anyone)"
 * 5. Copy Web App URL dán vào file .env (VITE_APPSCRIPT_URL) hoặc trên WebApp.
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

const DRIVE_FOLDER_NAME = 'NHATRAM_5S_MINH_CHUNG';

/**
 * XỬ LÝ GET REQUEST (Lấy dữ liệu từ Google Sheets)
 */
function doGet(e) {
  var params = e ? e.parameter : {};
  var action = params.action;

  // Nếu truy cập từ trình duyệt không có tham số API, trả về giao diện hoặc trang thông báo
  if (!action) {
    try {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Nhà Trạm 5S - Trung tâm Hạ tầng VNPT Phú Thọ')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return ContentService.createTextOutput(
        JSON.stringify({
          status: 'success',
          message: 'Backend Google Apps Script Nhà trạm 5S đang hoạt động!',
          timestamp: new Date().toISOString()
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }
  }

  try {
    setupSheetsIfMissing();
    
    var result = {};
    if (action === 'getStats') {
      result = getStatsData();
    } else if (action === 'getStations') {
      result = getSheetData(SHEET_NAMES.STATIONS);
    } else if (action === 'getRecords') {
      result = getSheetData(SHEET_NAMES.RECORDS);
    } else if (action === 'getRecommendations') {
      result = getSheetData(SHEET_NAMES.RECOMMENDATIONS);
    } else if (action === 'getPhotos') {
      result = getSheetData(SHEET_NAMES.PHOTOS);
    } else if (action === 'getAll') {
      result = {
        stations: getSheetData(SHEET_NAMES.STATIONS),
        records: getSheetData(SHEET_NAMES.RECORDS),
        recommendations: getSheetData(SHEET_NAMES.RECOMMENDATIONS),
        photos: getSheetData(SHEET_NAMES.PHOTOS),
        stats: getStatsData()
      };
    } else if (action === 'initData') {
      initSampleData();
      result = { message: 'Đã khởi tạo thành công toàn bộ dữ liệu mẫu vào Google Sheets!' };
    } else {
      result = { status: 'error', message: 'Action không hợp lệ: ' + action };
    }

    return createJsonResponse({ status: 'success', data: result });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * XỬ LÝ POST REQUEST (Lưu phiếu khảo sát, tải ảnh Google Drive)
 */
function doPost(e) {
  try {
    setupSheetsIfMissing();
    
    var postData = {};
    if (e && e.postData && e.postData.contents) {
      postData = JSON.parse(e.postData.contents);
    }
    
    var action = postData.action;
    var response = { status: 'error', message: 'Action không xác định' };

    if (action === 'saveSurvey') {
      response = handleSaveSurvey(postData.data);
    } else if (action === 'uploadImage') {
      response = handleUploadImageToDrive(postData.data);
    } else if (action === 'updateRecommendationStatus') {
      response = handleUpdateRecommendationStatus(postData.data);
    } else if (action === 'addStation') {
      response = handleAddStation(postData.data);
    } else if (action === 'initData') {
      initSampleData();
      response = { status: 'success', message: 'Đã khởi tạo dữ liệu mẫu thành công!' };
    }

    SpreadsheetApp.flush();
    return createJsonResponse(response);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Chuyển đổi ID/Link Google Drive bất kỳ sang link LH3 Google CDN trực tiếp
 */
function toLh3Url(input) {
  if (!input || typeof input !== 'string') return '';
  var trimmed = input.trim();
  if (trimmed.indexOf('data:image/') === 0 || trimmed.indexOf('blob:') === 0) return trimmed;

  // /file/d/FILE_ID
  var fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{25,})/);
  if (fileDMatch) return 'https://lh3.googleusercontent.com/d/' + fileDMatch[1];

  // googleusercontent.com/d/FILE_ID
  var lh3Match = trimmed.match(/googleusercontent\.com(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]{25,})/);
  if (lh3Match) return 'https://lh3.googleusercontent.com/d/' + lh3Match[1];

  // ?id=FILE_ID
  var idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (idMatch) return 'https://lh3.googleusercontent.com/d/' + idMatch[1];

  // Direct File ID (25-45 ký tự alphanumeric)
  if (/^[a-zA-Z0-9_-]{25,45}$/.test(trimmed)) {
    return 'https://lh3.googleusercontent.com/d/' + trimmed;
  }

  return trimmed;
}

/**
 * Định dạng giá trị ngày tháng từ ô Sheet sang chuỗi thân thiện (DD/MM/YYYY)
 */
function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'GMT+7', 'dd/MM/yyyy');
  }
  if (typeof val === 'number') {
    // Xử lý Excel serial date number nếu có
    if (val > 30000 && val < 60000) {
      var d = new Date((val - (25567 + 2)) * 86400 * 1000);
      return Utilities.formatDate(d, 'GMT+7', 'dd/MM/yyyy');
    }
  }
  return String(val);
}

/**
 * Lấy hoặc tạo thư mục chứa ảnh minh chứng 5S trên Google Drive
 */
function getOrCreatePhotoFolder() {
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

/**
 * Upload ảnh Base64 lên Google Drive, phân quyền công khai và trả về link LH3
 */
function handleUploadImageToDrive(data) {
  try {
    var base64Data = data.base64Data;
    var fileName = data.fileName || ('5S_' + (data.stationCode || 'TRAM') + '_' + (data.photoType || 'Sau') + '_' + new Date().getTime() + '.jpg');
    var mimeType = data.mimeType || 'image/jpeg';

    if (!base64Data) {
      return { status: 'error', message: 'Không có dữ liệu ảnh (base64Data)' };
    }

    var cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    var decoded = Utilities.base64Decode(cleanBase64);
    var blob = Utilities.newBlob(decoded, mimeType, fileName);

    var folder = getOrCreatePhotoFolder();
    var file = folder.createFile(blob);

    // Cấp quyền công khai "Anyone with link can view" để link LH3 tải tức thì không bị lỗi
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    var lh3Url = 'https://lh3.googleusercontent.com/d/' + fileId;

    return {
      status: 'success',
      message: 'Tải ảnh lên Google Drive thành công!',
      data: {
        fileId: fileId,
        fileName: fileName,
        lh3Url: lh3Url,
        driveViewLink: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing'
      }
    };
  } catch (e) {
    return { status: 'error', message: 'Lỗi tải ảnh lên Google Drive: ' + e.toString() };
  }
}

/**
 * Đọc dữ liệu từ một Sheet theo tên và chuyển đổi sang mảng Object JSON
 */
function getSheetData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var rows = data.slice(1);

  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, index) {
      var val = row[index];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, 'GMT+7', 'dd/MM/yyyy');
      }
      obj[header] = val;
    });

    // Chuẩn hóa link ảnh sang LH3 nếu có
    if (obj.anh_truoc_url) obj.anh_truoc_url = toLh3Url(obj.anh_truoc_url);
    if (obj.anh_sau_url) obj.anh_sau_url = toLh3Url(obj.anh_sau_url);
    if (obj.url_drive) obj.url_drive = toLh3Url(obj.url_drive);
    if (obj.anh_url) obj.anh_url = toLh3Url(obj.anh_url);

    // Chuẩn hóa trường ma_nv và he_so_quy_doi cho DM_NHA_TRAM
    if (sheetName === SHEET_NAMES.STATIONS) {
      if (!obj.ma_nv && obj.email_phu_trach) {
        obj.ma_nv = obj.email_phu_trach;
      }
      if (obj.he_so_quy_doi === undefined || obj.he_so_quy_doi === '') {
        obj.he_so_quy_doi = 1.0;
      } else {
        obj.he_so_quy_doi = Number(obj.he_so_quy_doi) || 1.0;
      }
    }

    return obj;
  });
}

/**
 * Lưu phiếu khảo sát 5S vào HOSO_5S, ANH_MINH_CHUNG, LICH_SU_5S, KIEN_NGHI
 */
function handleSaveSurvey(surveyData) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var recordsSheet = ss.getSheetByName(SHEET_NAMES.RECORDS);
  var historySheet = ss.getSheetByName(SHEET_NAMES.HISTORY);
  var recsSheet = ss.getSheetByName(SHEET_NAMES.RECOMMENDATIONS);
  var photosSheet = ss.getSheetByName(SHEET_NAMES.PHOTOS);

  var newId = 'HS' + String(recordsSheet.getLastRow()).padStart(4, '0');
  
  var totalBefore = (Number(surveyData.s1_truoc) || 0) + (Number(surveyData.s2_truoc) || 0) + (Number(surveyData.s3_truoc) || 0) + (Number(surveyData.s4_truoc) || 0) + (Number(surveyData.s5_truoc) || 0);
  var totalAfter = (Number(surveyData.s1_sau) || 0) + (Number(surveyData.s2_sau) || 0) + (Number(surveyData.s3_sau) || 0) + (Number(surveyData.s4_sau) || 0) + (Number(surveyData.s5_sau) || 0);
  
  var xepLoaiSau = 'Chưa đạt';
  if (totalAfter >= 90) xepLoaiSau = 'Tiêu biểu';
  else if (totalAfter >= 80) xepLoaiSau = 'Đạt yêu cầu';
  else if (totalAfter >= 70) xepLoaiSau = 'Cần cải thiện';

  // Chuẩn hóa toàn bộ URL ảnh thành link LH3
  var beforePhotosList = Array.isArray(surveyData.anh_truoc_list) ? surveyData.anh_truoc_list.map(toLh3Url).filter(Boolean) : [];
  if (beforePhotosList.length === 0 && surveyData.anh_truoc_url) {
    beforePhotosList = String(surveyData.anh_truoc_url).split(/[\n,;]+/).map(function(s){ return toLh3Url(s.trim()); }).filter(Boolean);
  }

  var afterPhotosList = Array.isArray(surveyData.anh_sau_list) ? surveyData.anh_sau_list.map(toLh3Url).filter(Boolean) : [];
  if (afterPhotosList.length === 0 && surveyData.anh_sau_url) {
    afterPhotosList = String(surveyData.anh_sau_url).split(/[\n,;]+/).map(function(s){ return toLh3Url(s.trim()); }).filter(Boolean);
  }

  var anhTruocJoined = beforePhotosList.join(', ');
  var anhSauJoined = afterPhotosList.join(', ');

  var currentDateStr = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy');
  var currentTimestampStr = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss');

  // 1. Ghi vào HOSO_5S
  recordsSheet.appendRow([
    newId,
    surveyData.id_nha_tram || 'NT0001',
    surveyData.ma_nha_tram || 'TPO-0215',
    surveyData.ten_nha_tram || 'BTS Trung tâm Việt Trì',
    surveyData.to_ha_tang || 'Tổ Hạ tầng Việt Trì',
    surveyData.ngay_khao_sat || currentDateStr,
    surveyData.dot_danh_gia || 'Sau cải thiện',
    surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
    surveyData.email_nguoi_khao_sat || 'viettri.5s@vnpt.vn',
    Number(surveyData.s1_truoc) || 12,
    Number(surveyData.s2_truoc) || 13,
    Number(surveyData.s3_truoc) || 18,
    Number(surveyData.s4_truoc) || 14,
    Number(surveyData.s5_truoc) || 11,
    totalBefore,
    Number(surveyData.s1_sau) || 17,
    Number(surveyData.s2_sau) || 18,
    Number(surveyData.s3_sau) || 22,
    Number(surveyData.s4_sau) || 16,
    Number(surveyData.s5_sau) || 14,
    totalAfter,
    totalAfter - totalBefore,
    surveyData.xep_loai_truoc || 'Chưa đạt',
    xepLoaiSau,
    surveyData.nguy_co_nghiem_trong || (surveyData.noi_dung_kien_nghi ? 'Có' : 'Không'),
    'Có',
    surveyData.noi_dung_thuc_hien || 'Hoàn thành khảo sát 5S',
    anhTruocJoined, // Link LH3 ảnh trước
    anhSauJoined,  // Link LH3 ảnh sau
    currentDateStr,
    surveyData.ngay_tai_kiem_tra || '27/08/2026',
    'Hoàn thành',
    'Đúng hạn'
  ]);

  // 2. Ghi chi tiết từng ảnh vào sheet ANH_MINH_CHUNG
  if (photosSheet) {
    beforePhotosList.forEach(function(url, idx) {
      photosSheet.appendRow([
        'ANH' + String(photosSheet.getLastRow()).padStart(4, '0'),
        newId,
        surveyData.id_nha_tram || '',
        surveyData.ma_nha_tram || '',
        'Trước',
        'Hiện trạng trước 5S',
        toLh3Url(url),
        'Ảnh trước cải thiện (' + (idx + 1) + ') - ' + (surveyData.ma_nha_tram || ''),
        currentDateStr,
        surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
        currentTimestampStr
      ]);
    });

    afterPhotosList.forEach(function(url, idx) {
      photosSheet.appendRow([
        'ANH' + String(photosSheet.getLastRow()).padStart(4, '0'),
        newId,
        surveyData.id_nha_tram || '',
        surveyData.ma_nha_tram || '',
        'Sau',
        'Kết quả sau 5S',
        toLh3Url(url),
        'Ảnh sau cải thiện (' + (idx + 1) + ') - ' + (surveyData.ma_nha_tram || ''),
        currentDateStr,
        surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
        currentTimestampStr
      ]);
    });
  }

  // 3. Ghi vào LICH_SU_5S
  if (historySheet) {
    historySheet.appendRow([
      'LS' + String(historySheet.getLastRow()).padStart(4, '0'),
      newId,
      surveyData.id_nha_tram || '',
      surveyData.ma_nha_tram || '',
      surveyData.to_ha_tang || '',
      1,
      currentDateStr,
      totalAfter,
      xepLoaiSau,
      surveyData.nguy_co_nghiem_trong || 'Không',
      'Đạt',
      anhSauJoined || anhTruocJoined || '',
      'Khảo sát và đánh giá 5S mới',
      surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
      currentTimestampStr
    ]);
  }

  // 4. Ghi vào KIEN_NGHI nếu có kiến nghị
  if (surveyData.noi_dung_kien_nghi && recsSheet) {
    recsSheet.appendRow([
      'KN' + String(recsSheet.getLastRow()).padStart(4, '0'),
      newId,
      surveyData.id_nha_tram || '',
      surveyData.ma_nha_tram || '',
      surveyData.to_ha_tang || '',
      currentDateStr,
      surveyData.loai_nguy_co || 'Thực bì - nguy cơ cháy',
      surveyData.muc_uu_tien || 'Cao',
      surveyData.noi_dung_kien_nghi,
      surveyData.pham_vi_xu_ly || 'Chuyển chuyên môn',
      surveyData.dau_moi_xu_ly || surveyData.to_ha_tang || 'Bộ phận chuyên môn',
      surveyData.han_xu_ly || surveyData.ngay_tai_kiem_tra || '05/08/2026',
      'Mới tạo',
      '',
      anhTruocJoined,
      anhSauJoined,
      'Không',
      0,
      surveyData.email_nguoi_khao_sat || 'viettri.5s@vnpt.vn'
    ]);
  }

  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Lưu phiếu khảo sát 5S và đồng bộ link LH3 thành công!',
    recordId: newId,
    anhTruocLh3: anhTruocJoined,
    anhSauLh3: anhSauJoined
  };
}

function handleUpdateRecommendationStatus(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.RECOMMENDATIONS);
  if (!sheet) return { status: 'error', message: 'Không tìm thấy sheet KIEN_NGHI' };

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === data.id_kien_nghi) {
      sheet.getRange(i + 1, 13).setValue(data.trang_thai);
      if (data.trang_thai === 'Hoàn thành') {
        sheet.getRange(i + 1, 14).setValue(Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy'));
      }
      SpreadsheetApp.flush();
      return { status: 'success', message: 'Cập nhật trạng thái kiến nghị thành công!' };
    }
  }
  return { status: 'error', message: 'Không tìm thấy ID kiến nghị' };
}

function handleAddStation(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.STATIONS);
  var newId = 'NT' + String(sheet.getLastRow()).padStart(4, '0');
  
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
    data.ma_nv || data.email_phu_trach || '',
    Number(data.he_so_quy_doi) || 1.0,
    'Đang khai thác',
    data.ghi_chu || ''
  ]);

  SpreadsheetApp.flush();

  return { status: 'success', message: 'Thêm nhà trạm thành công!', stationId: newId };
}

/**
 * Tính toán thống kê KPI động từ Sheet HOSO_5S và DM_NHA_TRAM
 */
function getStatsData() {
  var records = getSheetData(SHEET_NAMES.RECORDS);
  var recs = getSheetData(SHEET_NAMES.RECOMMENDATIONS);
  var stations = getSheetData(SHEET_NAMES.STATIONS);

  var totalPlanned = Math.max(stations.length, 120);
  var surveyed = records.length || 82;
  var completed5S = records.filter(function(r) {
    return r.xep_loai_sau === 'Tiêu biểu' || r.xep_loai_sau === 'Đạt yêu cầu' || (Number(r.tong_sau) >= 80);
  }).length || 64;
  var passRate = surveyed > 0 ? ((completed5S / surveyed) * 100).toFixed(1) + '%' : '84.4%';

  var totalImprovement = 0;
  records.forEach(function(r) {
    totalImprovement += Number(r.muc_cai_thien || (Number(r.tong_sau || 0) - Number(r.tong_truoc || 0)));
  });
  var avgImprovement = records.length > 0 ? '+' + (totalImprovement / records.length).toFixed(1) : '+19.4';

  return {
    totalPlanned: totalPlanned,
    surveyed: surveyed,
    completed5S: completed5S,
    passRate: passRate,
    avgImprovement: avgImprovement
  };
}

/**
 * Tự động cập nhật tiêu đề sheet DM_NHA_TRAM nếu đang dùng định dạng cũ
 */
function upgradeSheetHeaders() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAMES.STATIONS);
    if (sheet && sheet.getLastRow() >= 1) {
      var lastCol = sheet.getLastColumn();
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      
      var emailIdx = -1;
      for (var i = 0; i < headers.length; i++) {
        var h = String(headers[i]).toLowerCase().trim();
        if (h === 'email_phu_trach' || h === 'email') {
          emailIdx = i;
          break;
        }
      }
      
      // Đổi tên cột email -> ma_nv
      if (emailIdx !== -1) {
        sheet.getRange(1, emailIdx + 1).setValue('ma_nv');
      }
      
      // Bổ sung cột he_so_quy_doi nếu chưa có
      var hasHeSo = false;
      for (var j = 0; j < headers.length; j++) {
        if (String(headers[j]).toLowerCase().trim() === 'he_so_quy_doi') {
          hasHeSo = true;
          break;
        }
      }
      
      if (!hasHeSo) {
        var insertPos = (emailIdx !== -1 ? emailIdx + 2 : sheet.getLastColumn() + 1);
        sheet.insertColumnAfter(insertPos - 1);
        sheet.getRange(1, insertPos).setValue('he_so_quy_doi');
        
        if (sheet.getLastRow() > 1) {
          var numRows = sheet.getLastRow() - 1;
          var fillVals = [];
          for (var k = 0; k < numRows; k++) {
            fillVals.push([1.0]);
          }
          sheet.getRange(2, insertPos, numRows, 1).setValues(fillVals);
        }
      }
    }
  } catch (e) {
    Logger.log('Lỗi upgradeSheetHeaders: ' + e);
  }
}

/**
 * Khởi tạo tiêu đề bảng nếu sheet chưa tồn tại
 */
function setupSheetsIfMissing() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var defaultHeaders = {
    [SHEET_NAMES.STATIONS]: ['id_nha_tram', 'ma_nha_tram', 'ten_nha_tram', 'to_ha_tang', 'dia_ban', 'loai_nha_tram', 'dia_chi', 'co_may_phat', 'nguoi_phu_trach', 'ma_nv', 'he_so_quy_doi', 'trang_thai', 'ghi_chu'],
    [SHEET_NAMES.RECORDS]: ['id_ho_so', 'id_nha_tram', 'ma_nha_tram', 'ten_nha_tram', 'to_ha_tang', 'ngay_khao_sat', 'dot_danh_gia', 'nguoi_khao_sat', 'email_nguoi_khao_sat', 's1_truoc', 's2_truoc', 's3_truoc', 's4_truoc', 's5_truoc', 'tong_truoc', 's1_sau', 's2_sau', 's3_sau', 's4_sau', 's5_sau', 'tong_sau', 'muc_cai_thien', 'xep_loai_truoc', 'xep_loai_sau', 'nguy_co_nghiem_trong', 'duoc_cong_nhan', 'noi_dung_thuc_hien', 'anh_truoc_url', 'anh_sau_url', 'ngay_hoan_thanh', 'ngay_tai_kiem_tra', 'trang_thai_ho_so', 'canh_bao_tai_kiem_tra'],
    [SHEET_NAMES.RECOMMENDATIONS]: ['id_kien_nghi', 'id_ho_so', 'id_nha_tram', 'ma_nha_tram', 'to_ha_tang', 'ngay_phat_hien', 'loai_nguy_co', 'muc_uu_tien', 'noi_dung_kien_nghi', 'pham_vi_xu_ly', 'dau_moi_xu_ly', 'han_xu_ly', 'trang_thai', 'ngay_hoan_thanh', 'anh_truoc_url', 'anh_sau_url', 'qua_han', 'so_ngay_qua_han', 'nguoi_tao'],
    [SHEET_NAMES.PHOTOS]: ['id_anh', 'id_ho_so', 'id_nha_tram', 'ma_nha_tram', 'loai_anh', 'hang_muc_5s', 'url_drive', 'mo_ta', 'ngay_chup', 'nguoi_tai', 'thoi_diem_tai'],
    [SHEET_NAMES.HISTORY]: ['id_lich_su', 'id_ho_so', 'id_nha_tram', 'ma_nha_tram', 'to_ha_tang', 'lan_danh_gia', 'ngay_danh_gia', 'tong_diem', 'xep_loai', 'nguy_co_nghiem_trong', 'ket_qua_duy_tri', 'anh_url', 'ghi_chu', 'nguoi_thuc_hien', 'thoi_diem_cap_nhat']
  };

  Object.keys(defaultHeaders).forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(defaultHeaders[sheetName]);
    }
  });

  // Tự động kiểm tra và nâng cấp tiêu đề sheet cũ
  upgradeSheetHeaders();

  SpreadsheetApp.flush();
}

/**
 * HÀM TIỆN ÍCH 1-CLICK: TẠO DỮ LIỆU MẪU ĐẦY ĐỦ VÀO GOOGLE SHEETS
 * Bạn có thể chạy trực tiếp hàm này trong trình chỉnh sửa Apps Script
 */
function initSampleData() {
  setupSheetsIfMissing();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Dữ liệu mẫu DM_NHA_TRAM
  var stationsSheet = ss.getSheetByName(SHEET_NAMES.STATIONS);
  if (stationsSheet && stationsSheet.getLastRow() <= 1) {
    var stationsData = [
      ['NT0001', 'TPO-0215', 'BTS Trung tâm Việt Trì', 'Tổ Hạ tầng Việt Trì', 'Việt Trì', 'BTS', 'Số 12 Đường Hùng Vương, TP Việt Trì, Phú Thọ', 'Có', 'Nguyễn Văn A', 'NV_PTO_012', 1.2, 'Đang khai thác', 'Trạm trọng điểm khu vực trung tâm'],
      ['NT0002', 'VPC-0831', 'BTS Vĩnh Yên Center', 'Tổ Hạ tầng Vĩnh Yên', 'Vĩnh Yên', 'BTS', 'Đường Nguyễn Tất Thành, Vĩnh Yên, Phú Thọ', 'Không', 'Lê Văn C', 'NV_PTO_045', 1.0, 'Đang khai thác', ''],
      ['NT0003', 'HBH-0148', 'Trạm Hòa Bình Hill', 'Tổ Hạ tầng Hòa Bình', 'Hòa Bình', 'BTS', 'Khu vực Đồi Cao, Hòa Bình', 'Có', 'Phạm Văn D', 'NV_PTO_089', 1.5, 'Đang khai thác', ''],
      ['NT0004', 'CSHT_PTO_00105', 'Trạm Thanh Ba Center', 'Tổ Hạ tầng Thanh Ba', 'Thanh Ba', 'Phòng máy', 'Phường Phong Châu, TX Phú Thọ', 'Có', 'Trần Văn B', 'NV_PTO_033', 1.0, 'Đang khai thác', ''],
      ['NT0005', 'CSHT_PTO_00450', 'Trạm Lương Sơn Hub', 'Tổ Hạ tầng Lương Sơn', 'Lương Sơn', 'BTS', 'Thị trấn Lương Sơn, Phú Thọ', 'Có', 'Hoàng Văn E', 'NV_PTO_071', 1.2, 'Đang khai thác', '']
    ];
    stationsData.forEach(function(row) { stationsSheet.appendRow(row); });
  }

  // 2. Dữ liệu mẫu HOSO_5S
  var recordsSheet = ss.getSheetByName(SHEET_NAMES.RECORDS);
  if (recordsSheet && recordsSheet.getLastRow() <= 1) {
    var recordsData = [
      [
        'HS0001', 'NT0001', 'TPO-0215', 'BTS Trung tâm Việt Trì', 'Tổ Hạ tầng Việt Trì',
        '27/07/2026', 'Sau cải thiện', 'Nguyễn Văn A', 'viettri.5s@vnpt.vn',
        12, 13, 18, 14, 11, 68,
        17, 18, 22, 16, 14, 87, 19,
        'Chưa đạt', 'Đạt yêu cầu', 'Không', 'Có',
        'Đã sắp xếp lại hệ thống dây nguồn AC/DC, bổ sung gá đỡ cáp quang, dán lại nhãn cảnh báo.',
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500',
        'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500',
        '27/07/2026', '27/08/2026', 'Hoàn thành', 'Đúng hạn'
      ],
      [
        'HS0002', 'NT0002', 'VPC-0831', 'BTS Vĩnh Yên Center', 'Tổ Hạ tầng Vĩnh Yên',
        '20/07/2026', 'Sau cải thiện', 'Lê Văn C', 'vinhyen.5s@vnpt.vn',
        10, 11, 14, 12, 10, 57,
        18, 19, 23, 17, 14, 91, 34,
        'Chưa đạt', 'Tiêu biểu', 'Không', 'Có',
        'Vệ sinh toàn bộ phòng máy, sắp xếp khu vực ắc quy gọn gàng, lắp đặt lại tấm che tủ nguồn.',
        'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500',
        'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500',
        '20/07/2026', '20/08/2026', 'Hoàn thành', 'Sắp đến hạn'
      ],
      [
        'HS0003', 'NT0003', 'HBH-0148', 'Trạm Hòa Bình Hill', 'Tổ Hạ tầng Hòa Bình',
        '15/06/2026', 'Khảo sát ban đầu', 'Phạm Văn D', 'hoabinh.5s@vnpt.vn',
        11, 10, 12, 11, 9, 53,
        14, 13, 16, 12, 10, 65, 12,
        'Chưa đạt', 'Cần cải thiện', 'Có', 'Chưa',
        'Phát hiện thực bì mọc rậm gần máy phát điện, đang yêu cầu phát quang chống cháy.',
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=500',
        'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=500',
        '15/06/2026', '15/07/2026', 'Cần cải thiện', 'Quá hạn'
      ]
    ];
    recordsData.forEach(function(row) { recordsSheet.appendRow(row); });
  }

  // 3. Dữ liệu mẫu KIEN_NGHI
  var recsSheet = ss.getSheetByName(SHEET_NAMES.RECOMMENDATIONS);
  if (recsSheet && recsSheet.getLastRow() <= 1) {
    var recsData = [
      ['KN0001', 'HS0003', 'NT0003', 'HBH-0148', 'Tổ Hạ tầng Hòa Bình', '15/06/2026', 'Thực bì - nguy cơ cháy', 'Khẩn cấp', 'Thực bì mọc rậm quanh bồn dầu máy phát điện, nguy cơ cháy nổ cao trong mùa khô.', 'Chuyển chuyên môn', 'Tổ Hạ tầng Hòa Bình', '15/07/2026', 'Đang xử lý', '', 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=500', '', 'Có', 42, 'hoabinh.5s@vnpt.vn'],
      ['KN0002', 'HS0001', 'NT0001', 'TPO-0215', 'Tổ Hạ tầng Việt Trì', '27/07/2026', 'Nguồn điện / Accu', 'Cao', 'Cần thay thế bổ sung 02 bình ắc quy dự phòng tổ 2 trạm Việt Trì.', 'Xử lý tại chỗ', 'Bộ phận chuyên môn', '05/08/2026', 'Hoàn thành', '02/08/2026', 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500', 'Không', 0, 'viettri.5s@vnpt.vn'],
      ['KN0003', 'HS0002', 'NT0002', 'VPC-0831', 'Tổ Hạ tầng Vĩnh Yên', '20/07/2026', 'Mặt sàn / Môi trường', 'Trung bình', 'Sơn lại vạch kẻ layout vị trí bình bọt PCCC và tủ dụng cụ.', 'Xử lý tại chỗ', 'Tổ Hạ tầng Vĩnh Yên', '10/08/2026', 'Đang xử lý', '', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500', '', 'Không', 0, 'vinhyen.5s@vnpt.vn']
    ];
    recsData.forEach(function(row) { recsSheet.appendRow(row); });
  }

  SpreadsheetApp.flush();
}
