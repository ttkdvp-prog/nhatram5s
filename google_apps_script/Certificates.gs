/**
 * =========================================================================
 * TẢI GIẤY KIỂM ĐỊNH / BẢN CÔNG BỐ MỚI
 * - Tra mã CSHT, kiểm tra quyền theo phạm vi người dùng.
 * - Lưu PDF vào Drive: anhkiemdinhBTS / <Tổ> / <Nhân viên> (cùng cấu trúc ảnh niêm yết hiện có).
 * - Tên file: YYYY-MM_<To ha tang>_<Ten NV>_<Ma CSHT>.pdf (bỏ dấu tiếng Việt).
 * - Cập nhật số giấy, ngày cấp, ngày hết hạn và link PDF vào DM_NHA_TRAM.
 * =========================================================================
 */

var CSHT_PATTERN = /^CSHT_[A-Z0-9]{2,6}_\d{4,6}$/;
var CERT_MAX_BYTES = 12 * 1024 * 1024;

function certStripDiacritics_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[\\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function certFindStation_(ma) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.STATIONS);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  var col = headers.indexOf('ma_nha_tram');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][col]).trim().toUpperCase() === ma) {
      var o = {};
      headers.forEach(function (h, idx) { o[h] = values[i][idx]; });
      return { sheet: sheet, row: i + 1, headers: headers, data: o };
    }
  }
  return null;
}

function certNormalizeMa_(raw) {
  return String(raw || '').trim().toUpperCase();
}

function certLookup_(user, data) {
  var ma = certNormalizeMa_(data && data.ma_nha_tram);
  if (!CSHT_PATTERN.test(ma)) {
    return { status: 'error', message: 'Mã CSHT sai định dạng (ví dụ: CSHT_HBH_00037)' };
  }
  var st = certFindStation_(ma);
  if (!st) return { status: 'error', message: 'Không tìm thấy mã CSHT ' + ma + ' trong danh mục' };
  if (!authRowInScope_(user, st.data)) {
    return { status: 'error', code: 'FORBIDDEN', message: 'Trạm này không thuộc phạm vi bạn được cập nhật' };
  }
  var d = st.data;
  return {
    status: 'success',
    data: {
      ma_nha_tram: ma, id_nha_tram: String(d.id_nha_tram), ten_nha_tram: String(d.ten_nha_tram),
      to_ha_tang: String(d.to_ha_tang), nguoi_phu_trach: String(d.nguoi_phu_trach),
      GCN_kiem_dinh: String(d.GCN_kiem_dinh || ''), GCN_cong_bo: String(d.GCN_cong_bo || '')
    }
  };
}

function certParseDate_(s) {
  var m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) || d.getDate() !== Number(m[1]) ? null : d;
}

function certFileName_(startDate, st) {
  var ym = Utilities.formatDate(startDate, 'GMT+7', 'yyyy-MM');
  return ym + '_' + certStripDiacritics_(st.to_ha_tang) + '_' + certStripDiacritics_(st.nguoi_phu_trach) + '_' + certStripDiacritics_(st.ma_nha_tram) + '.pdf';
}

/** Tìm file cũ cùng mã CSHT trong thư mục (so khớp theo phần đuôi tên: "_<mã CSHT>.pdf"). */
function certFindExisting_(folder, ma) {
  var suffix = '_' + ma + '.pdf';
  var out = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed() && f.getName().toUpperCase().slice(-suffix.length) === suffix) out.push(f);
  }
  return out;
}

/** Số ảnh niêm yết hiện có của từng trạm (theo id_nha_tram) trong KIEM_DINH_BTS. */
function certPhotoCount_() {
  var out = {};
  getBtsInspectionsData().forEach(function (b) {
    var l = b.anh_niem_yet_list;
    var n = Array.isArray(l) ? l.length : (l ? String(l).split(/[,\n|]+/).filter(String).length : 0);
    out[String(b.id_nha_tram)] = n;
  });
  return out;
}

/** Admin: chốt mốc ảnh cho các trạm đã có link_giay_pdf nhưng chưa có mốc (dữ liệu nhập trước đây). */
function certBackfill_(user) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ admin được chốt mốc' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.STATIONS);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  ['link_giay_pdf', 'so_anh_truoc', 'ngay_tai_giay'].forEach(function (h) {
    if (headers.indexOf(h) === -1) { sheet.getRange(1, headers.length + 1).setValue(h); headers.push(h); }
  });
  var cLink = headers.indexOf('link_giay_pdf'), cBase = headers.indexOf('so_anh_truoc'), cAt = headers.indexOf('ngay_tai_giay'), cId = headers.indexOf('id_nha_tram');
  var counts = certPhotoCount_();
  var n = 0;
  for (var i = 1; i < values.length; i++) {
    var link = String(values[i][cLink] || '').trim();
    var base = cBase < values[i].length ? values[i][cBase] : '';
    if (link && (base === '' || base === null)) {
      sheet.getRange(i + 1, cBase + 1).setValue(counts[String(values[i][cId])] || 0);
      sheet.getRange(i + 1, cAt + 1).setValue(new Date());
      n++;
    }
  }
  SpreadsheetApp.flush();
  return { status: 'success', message: 'Đã chốt mốc ảnh cho ' + n + ' trạm', data: { updated: n } };
}

function certUpload_(user, data) {
  var lk = certLookup_(user, data);
  if (lk.status !== 'success') return lk;
  var info = lk.data;

  var loai = data.loai === 'cong_bo' ? 'cong_bo' : 'kiem_dinh';
  var soGiay = String(data.so_giay || '').trim();
  var start = certParseDate_(data.ngay_bat_dau);
  var end = certParseDate_(data.ngay_het_han);
  if (!soGiay) return { status: 'error', message: 'Thiếu số giấy' };
  if (!start || !end) return { status: 'error', message: 'Ngày bắt đầu/hết hạn phải theo dạng dd/MM/yyyy' };
  if (end.getTime() <= start.getTime()) return { status: 'error', message: 'Ngày hết hạn phải sau ngày bắt đầu' };

  var b64 = String(data.base64Data || '').replace(/^data:[^;]+;base64,/, '');
  if (!b64) return { status: 'error', message: 'Thiếu file PDF' };
  var bytes = Utilities.base64Decode(b64);
  if (bytes.length > CERT_MAX_BYTES) return { status: 'error', message: 'File PDF vượt quá 12MB' };
  // Kiểm tra chữ ký PDF để không lưu nhầm file khác
  if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
    return { status: 'error', message: 'File tải lên không phải PDF hợp lệ' };
  }

  var folder = getOrCreateNestedFolder([BTS_DRIVE_FOLDER_NAME, info.to_ha_tang || 'Chưa phân tổ', info.nguoi_phu_trach || 'Chưa phân công']);
  var existing = certFindExisting_(folder, info.ma_nha_tram);
  if (existing.length && !data.overwrite) {
    return {
      status: 'exists',
      message: 'Đã có file của mã ' + info.ma_nha_tram + ' trên Drive',
      data: existing.map(function (f) { return { name: f.getName(), url: f.getUrl() }; })
    };
  }

  var fileName = certFileName_(start, info);
  var blob = Utilities.newBlob(bytes, 'application/pdf', fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var url = 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing';
  // Bản cũ chỉ bị đưa vào thùng rác Drive (khôi phục được) sau khi bản mới đã lưu thành công
  existing.forEach(function (f) { f.setTrashed(true); });

  var st = certFindStation_(info.ma_nha_tram);
  var suffix = loai === 'cong_bo' ? 'cong_bo' : 'kiem_dinh';
  var set = {};
  set['GCN_' + suffix] = soGiay;
  set['nam_cap_' + suffix] = start.getFullYear();
  set['ngay_cap_' + suffix] = start;
  set['ngay_het_han_' + suffix] = end;

  var headers = st.headers.slice();
  ['link_giay_pdf', 'so_anh_truoc', 'ngay_tai_giay'].forEach(function (h) {
    if (headers.indexOf(h) === -1) {
      st.sheet.getRange(1, headers.length + 1).setValue(h);
      headers.push(h);
    }
  });
  set['link_giay_pdf'] = url;
  // Mốc ảnh niêm yết lúc tải giấy mới: chỉ ảnh thêm SAU mốc này mới tính là đã dán giấy mới
  set['so_anh_truoc'] = certPhotoCount_()[String(info.id_nha_tram)] || 0;
  set['ngay_tai_giay'] = new Date();
  Object.keys(set).forEach(function (h) {
    var c = headers.indexOf(h);
    if (c !== -1) st.sheet.getRange(st.row, c + 1).setValue(set[h]);
  });
  SpreadsheetApp.flush();

  return {
    status: 'success',
    message: 'Đã lưu giấy ' + info.ma_nha_tram + ' và cập nhật hạn kiểm định',
    data: { fileName: fileName, url: url, replaced: existing.length }
  };
}
