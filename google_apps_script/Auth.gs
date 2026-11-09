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
