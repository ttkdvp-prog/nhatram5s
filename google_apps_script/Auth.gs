/**
 * =========================================================================
 * XÁC THỰC & PHÂN QUYỀN - sheet "NguoiDung"
 * Cột: TenDangNhap | MaNV | TenNV | To | ChucDanh | Email | VaiTro | MatKhauHash | MatKhau
 * Cột bổ sung tự tạo: DaXacNhanMK | NgayDoiMK
 *
 * - Mật khẩu KHÔNG lưu dạng văn bản: MatKhauHash = "salt$hex" (SHA-256 lặp 2000 vòng, muối riêng từng người).
 * - Cột "MatKhau" luôn để trống (không dùng).
 * - MatKhauHash trống = tài khoản chưa từng đặt mật khẩu -> chỉ đăng nhập được bằng mật khẩu mặc định "1".
 * - Phiên đăng nhập: mã ngẫu nhiên lưu trong CacheService, hết hạn sau 6 giờ.
 * - Sai mật khẩu 5 lần liên tiếp -> khóa tài khoản 15 phút.
 * =========================================================================
 */

var AUTH_SHEET = 'NguoiDung';
var AUTH_DEFAULT_PASSWORD = '1';
var AUTH_SESSION_SECONDS = 6 * 60 * 60;
var AUTH_MAX_FAILS = 5;
var AUTH_LOCK_SECONDS = 15 * 60;
var AUTH_HASH_ROUNDS = 2000;

function authHex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function authHash_(password, salt) {
  var h = salt + '|' + password;
  for (var i = 0; i < AUTH_HASH_ROUNDS; i++) {
    h = authHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + h, Utilities.Charset.UTF_8));
  }
  return h;
}

function authMakeStored_(password) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return salt + '$' + authHash_(password, salt);
}

function authVerifyStored_(password, stored) {
  var parts = String(stored).split('$');
  if (parts.length !== 2) return false;
  return authHash_(password, parts[0]) === parts[1];
}

/** Đọc sheet người dùng; tự thêm 2 cột bổ sung nếu chưa có. */
function authGetSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUTH_SHEET);
  if (!sheet) throw new Error('Không tìm thấy sheet ' + AUTH_SHEET);
  var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(String);
  ['DaXacNhanMK', 'NgayDoiMK'].forEach(function (name) {
    if (headers.indexOf(name) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(name);
      headers.push(name);
    }
  });
  return { sheet: sheet, headers: headers };
}

function authFindUser_(username) {
  var s = authGetSheet_();
  var values = s.sheet.getDataRange().getValues();
  var u = String(username || '').trim().toLowerCase();
  if (!u) return null;
  var col = s.headers.indexOf('TenDangNhap');
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][col]).trim().toLowerCase() === u) {
      var obj = {};
      s.headers.forEach(function (h, idx) { obj[h] = values[i][idx]; });
      return { row: i + 1, data: obj, sheet: s.sheet, headers: s.headers };
    }
  }
  return null;
}

function authSet_(found, field, value) {
  found.sheet.getRange(found.row, found.headers.indexOf(field) + 1).setValue(value);
}

function authNormalizeRole_(r) {
  var v = String(r || '').trim().toLowerCase().replace(/[\s_-]/g, '');
  if (v === 'admin' || v === 'quantri') return 'admin';
  if (v === 'totruong') return 'totruong';
  return 'nhanvien';
}

function authPublicUser_(found, extra) {
  var d = found.data;
  var out = {
    username: String(d.TenDangNhap).trim(),
    maNV: String(d.MaNV || '').trim(),
    ten: String(d.TenNV || '').trim(),
    to: String(d.To || '').trim(),
    chucDanh: String(d.ChucDanh || '').trim(),
    email: String(d.Email || '').trim(),
    role: authNormalizeRole_(d.VaiTro)
  };
  if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

function authIsWeak_(found) {
  var stored = String(found.data.MatKhauHash || '');
  if (!stored) return true;
  return authVerifyStored_(AUTH_DEFAULT_PASSWORD, stored);
}

function authLogin_(data) {
  var cache = CacheService.getScriptCache();
  var username = String((data && data.username) || '').trim().toLowerCase();
  var password = String((data && data.password) || '');
  if (!username || !password) return { status: 'error', message: 'Vui lòng nhập tên đăng nhập và mật khẩu' };

  var lockKey = 'lock_' + username;
  var failKey = 'fail_' + username;
  if (cache.get(lockKey)) {
    return { status: 'error', code: 'LOCKED', message: 'Tài khoản tạm khóa 15 phút do nhập sai nhiều lần' };
  }

  var found = authFindUser_(username);
  var ok = false;
  if (found) {
    var stored = String(found.data.MatKhauHash || '');
    ok = stored ? authVerifyStored_(password, stored) : (password === AUTH_DEFAULT_PASSWORD);
  }

  if (!ok) {
    var fails = Number(cache.get(failKey) || 0) + 1;
    if (fails >= AUTH_MAX_FAILS) {
      cache.put(lockKey, '1', AUTH_LOCK_SECONDS);
      cache.remove(failKey);
      return { status: 'error', code: 'LOCKED', message: 'Sai quá 5 lần, tài khoản tạm khóa 15 phút' };
    }
    cache.put(failKey, String(fails), AUTH_LOCK_SECONDS);
    return { status: 'error', message: 'Sai tên đăng nhập hoặc mật khẩu' };
  }

  cache.remove(failKey);
  var user = authPublicUser_(found);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  cache.put('sess_' + token, JSON.stringify(user), AUTH_SESSION_SECONDS);

  var weak = authIsWeak_(found);
  var confirmed = String(found.data.DaXacNhanMK).toUpperCase() === 'TRUE';
  return {
    status: 'success',
    data: { token: token, user: user, weak: weak, mustChoose: !confirmed }
  };
}

/** Trả về user của phiên hoặc null. */
function authGetUser_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('sess_' + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function authLogout_(token) {
  if (token) CacheService.getScriptCache().remove('sess_' + token);
  return { status: 'success' };
}

/** Giữ nguyên mật khẩu mặc định: lưu băm của "1" và đánh dấu đã xác nhận. */
function authKeepPassword_(user) {
  var found = authFindUser_(user.username);
  if (!found) return { status: 'error', message: 'Không tìm thấy tài khoản' };
  if (!String(found.data.MatKhauHash || '')) authSet_(found, 'MatKhauHash', authMakeStored_(AUTH_DEFAULT_PASSWORD));
  authSet_(found, 'DaXacNhanMK', 'TRUE');
  return { status: 'success', message: 'Đã giữ nguyên mật khẩu hiện tại' };
}

function authChangePassword_(user, data) {
  var found = authFindUser_(user.username);
  if (!found) return { status: 'error', message: 'Không tìm thấy tài khoản' };
  var oldPw = String((data && data.oldPassword) || '');
  var newPw = String((data && data.newPassword) || '');
  var stored = String(found.data.MatKhauHash || '');
  var okOld = stored ? authVerifyStored_(oldPw, stored) : (oldPw === AUTH_DEFAULT_PASSWORD);
  if (!okOld) return { status: 'error', message: 'Mật khẩu hiện tại không đúng' };
  if (newPw.length < 6) return { status: 'error', message: 'Mật khẩu mới tối thiểu 6 ký tự' };
  if (newPw === AUTH_DEFAULT_PASSWORD) return { status: 'error', message: 'Mật khẩu mới không được là mật khẩu mặc định' };
  authSet_(found, 'MatKhauHash', authMakeStored_(newPw));
  authSet_(found, 'MatKhau', '');
  authSet_(found, 'DaXacNhanMK', 'TRUE');
  authSet_(found, 'NgayDoiMK', Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss'));
  return { status: 'success', message: 'Đổi mật khẩu thành công' };
}

/** Admin đặt lại về trạng thái chưa đổi (mật khẩu mặc định "1"). */
function authResetPassword_(user, data) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ quản trị mới được đặt lại mật khẩu' };
  var found = authFindUser_(data && data.username);
  if (!found) return { status: 'error', message: 'Không tìm thấy tài khoản' };
  authSet_(found, 'MatKhauHash', '');
  authSet_(found, 'MatKhau', '');
  authSet_(found, 'DaXacNhanMK', '');
  CacheService.getScriptCache().remove('lock_' + String(found.data.TenDangNhap).trim().toLowerCase());
  return { status: 'success', message: 'Đã đặt lại mật khẩu về mặc định' };
}

/** ---------- Phân quyền theo phạm vi trạm ---------- */

function authRowInScope_(user, row) {
  if (user.role === 'admin') return true;
  if (user.role === 'totruong') return String(row.to_ha_tang || '').trim() === user.to;
  return String(row.ma_nv || '').trim() === user.maNV;
}

function authScopeRows_(user, rows) {
  if (user.role === 'admin') return rows;
  return rows.filter(function (r) { return authRowInScope_(user, r); });
}

/** Lọc các dòng gắn với trạm bằng tập mã trạm trong phạm vi. */
function authScopeByStationIds_(user, rows, stationIdSet) {
  if (user.role === 'admin') return rows;
  return rows.filter(function (r) {
    return stationIdSet[String(r.id_nha_tram || '')] || stationIdSet[String(r.ma_nha_tram || '')];
  });
}

function authCanWriteStation_(user, idNhaTram) {
  if (user.role === 'admin') return true;
  if (!idNhaTram) return false;
  var stations = getSheetData(SHEET_NAMES.STATIONS);
  for (var i = 0; i < stations.length; i++) {
    var s = stations[i];
    if (String(s.id_nha_tram) === String(idNhaTram) || String(s.ma_nha_tram) === String(idNhaTram)) {
      return authRowInScope_(user, s);
    }
  }
  return false;
}

/** Chạy 1 lần thủ công nếu muốn kiểm tra sheet người dùng và tạo cột bổ sung. */
function authSetup() {
  authGetSheet_();
}

/** ---------- NHẬT KÝ THAO TÁC (chỉ ghi thêm, không có hàm sửa/xóa) ---------- */

var AUDIT_SHEET = 'NHAT_KY';
var AUDIT_HEADERS = ['thoi_diem', 'tai_khoan', 'ten_nv', 'to_ha_tang', 'ma_tram', 'loai_thao_tac', 'chi_tiet', 'thoi_gian_xu_ly_giay', 'ket_qua'];

var AUDIT_ACTION_LABELS = {
  saveSurvey: 'Lưu phiếu khảo sát 5S',
  uploadImage: 'Tải ảnh',
  uploadBtsImage: 'Tải ảnh niêm yết',
  saveBtsInspection: 'Cập nhật công bố kiểm định',
  saveBtsInspectionBatch: 'Tải ảnh/PDF niêm yết',
  removeBtsInspectionPhoto: 'Xóa ảnh niêm yết',
  updateBtsExpiryStatus: 'Cập nhật hạn kiểm định',
  updateRecommendationStatus: 'Cập nhật kiến nghị',
  addStation: 'Thêm trạm',
  changePassword: 'Đổi mật khẩu',
  resetPassword: 'Đặt lại mật khẩu',
  keepPassword: 'Giữ nguyên mật khẩu'
};

function auditSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(AUDIT_SHEET);
  if (!sh) {
    sh = ss.insertSheet(AUDIT_SHEET);
    sh.appendRow(AUDIT_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Ghi 1 dòng nhật ký. Lỗi ghi nhật ký không được làm hỏng thao tác chính. */
function auditLog_(user, maTram, loai, chiTiet, giay, ketQua) {
  try {
    auditSheet_().appendRow([
      Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss'),
      user.username, user.ten, user.to,
      maTram || '', loai, chiTiet || '',
      giay === undefined || giay === null ? '' : giay,
      ketQua || 'Thành công'
    ]);
  } catch (e) {
    Logger.log('auditLog_ lỗi: ' + e);
  }
}

/** Đọc nhật ký gần nhất, đã lọc theo phạm vi: admin tất cả, tổ trưởng cùng tổ, nhân viên chỉ của mình. */
function auditRead_(user, limit) {
  var sh = auditSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = Math.min(limit || 1000, last - 1);
  var vals = sh.getRange(last - n + 1, 1, n, AUDIT_HEADERS.length).getValues();
  var out = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var o = {};
    AUDIT_HEADERS.forEach(function (h, idx) { o[h] = vals[i][idx]; });
    if (user.role === 'admin' ||
        (user.role === 'totruong' && String(o.to_ha_tang) === user.to) ||
        String(o.tai_khoan) === user.username) {
      out.push(o);
    }
  }
  return out;
}

/** ---------- ĐỐI SOÁT MINH CHỨNG: băm MD5 tệp Drive (quét theo lô, có nhớ tiến độ) ---------- */

var HASH_SHEET = 'HASH_MINH_CHUNG';
var HASH_HEADERS = ['file_id', 'md5', 'kich_thuoc', 'trang_thai', 'thoi_diem'];
var HASH_MAX_BYTES = 25 * 1024 * 1024;

function hashSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(HASH_SHEET);
  if (!sh) {
    sh = ss.insertSheet(HASH_SHEET);
    sh.appendRow(HASH_HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function hashRead_() {
  var sh = hashSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, HASH_HEADERS.length).getValues().map(function (r) {
    return { file_id: String(r[0]), md5: String(r[1]), kich_thuoc: r[2], trang_thai: String(r[3]) };
  });
}

/** Danh sách file_id Drive đang được gắn làm minh chứng niêm yết. */
function hashCollectFileIds_() {
  var rows = getBtsInspectionsData();
  var ids = {};
  rows.forEach(function (r) {
    (r.anh_niem_yet_list || []).forEach(function (u) {
      var id = extractDriveFileIdFromUrl(String(u));
      if (id) ids[id] = true;
    });
  });
  return Object.keys(ids);
}

/** Quét tối đa maxFiles tệp chưa băm trong giới hạn thời gian. Chỉ admin được gọi. */
function hashScan_(user, maxFiles) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ quản trị được quét minh chứng' };
  var started = Date.now();
  var done = {};
  hashRead_().forEach(function (h) { done[h.file_id] = true; });
  var todo = hashCollectFileIds_().filter(function (id) { return !done[id]; });
  var batch = [];
  var processed = 0;
  var stamp = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss');

  for (var i = 0; i < todo.length && processed < (maxFiles || 40); i++) {
    if (Date.now() - started > 240000) break;
    var id = todo[i];
    try {
      var file = DriveApp.getFileById(id);
      if (file.isTrashed()) throw new Error('trashed');
      var size = file.getSize();
      if (size > HASH_MAX_BYTES) {
        batch.push([id, '', size, 'BO_QUA_QUA_LON', stamp]);
      } else {
        var bytes = file.getBlob().getBytes();
        if (!bytes || bytes.length === 0) throw new Error('empty');
        batch.push([id, authHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes)), size, 'OK', stamp]);
      }
    } catch (e) {
      batch.push([id, '', '', 'LOI', stamp]);
    }
    processed++;
  }
  if (batch.length) {
    var sh = hashSheet_();
    sh.getRange(sh.getLastRow() + 1, 1, batch.length, HASH_HEADERS.length).setValues(batch);
  }
  return { status: 'success', data: { processed: processed, remaining: Math.max(0, todo.length - processed) } };
}
