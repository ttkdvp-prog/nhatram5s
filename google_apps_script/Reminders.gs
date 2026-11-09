/**
 * =========================================================================
 * NHẮC VIỆC TỰ ĐỘNG
 * - Quy tắc bật/tắt lưu ở sheet NHAC_VIEC_QUY_TAC.
 * - Lịch sử nhắc lưu ở sheet NHAC_VIEC_LICH_SU (chỉ ghi thêm); cũng là "thông báo trong app".
 * - Kênh: thông báo trong app + email (MailApp). Zalo: giao diện cho sao chép tin nhắn gửi tay.
 * - Quy tắc mặc định TẮT; gửi email thật chỉ khi admin bấm gửi hoặc bật lịch tự động.
 * =========================================================================
 */

var REMINDER_YEAR = 2026;
var RULE_SHEET = 'NHAC_VIEC_QUY_TAC';
var RULE_HEADERS = ['ma_quy_tac', 'bat', 'ngay_bat_dau'];
var REM_HISTORY_SHEET = 'NHAC_VIEC_LICH_SU';
var REM_HISTORY_HEADERS = ['thoi_diem', 'quy_tac', 'nguoi_nhan', 'ten_nguoi_nhan', 'email', 'so_tram', 'kenh', 'tieu_de', 'noi_dung', 'ma_tram_list', 'trang_thai'];

var REMINDER_RULES = [
  { id: 'HET_HAN_30', ten: 'Sắp hết hạn trong 30 ngày', nguoi_nhan: 'Nhân viên quản lý trạm' },
  { id: 'CHUA_DAN_14', ten: 'Chưa dán sau 14 ngày kể từ khi giao', nguoi_nhan: 'Tổ trưởng' },
  { id: 'TON_CUOI_TUAN', ten: 'Tồn việc cuối tuần', nguoi_nhan: 'Đầu mối quản trị dữ liệu' }
];

function remSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Đọc ngày: hỗ trợ dd/MM/yyyy và M/d/yyyy (nếu số đầu > 12 thì chắc chắn là ngày). */
function remParseDate_(s) {
  if (!s) return null;
  var p = String(s).trim().split(/[\/\-]/).map(Number);
  if (p.length < 3 || !p[0] || !p[1] || !p[2]) return null;
  var day = p[0], month = p[1];
  if (month > 12 && day <= 12) { var t = day; day = month; month = t; }
  var d = new Date(p[2], month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

function remEffectiveExpiry_(st) {
  var a = st.GCN_kiem_dinh ? remParseDate_(st.ngay_het_han_kiem_dinh) : null;
  var b = st.GCN_cong_bo ? remParseDate_(st.ngay_het_han_cong_bo) : null;
  if (a && b) return a.getTime() >= b.getTime() ? a : b;
  return a || b;
}

function remFmt_(d) {
  return Utilities.formatDate(d, 'GMT+7', 'dd/MM/yyyy');
}

function remRulesState_() {
  var sh = remSheet_(RULE_SHEET, RULE_HEADERS);
  var vals = sh.getDataRange().getValues();
  var state = {};
  for (var i = 1; i < vals.length; i++) {
    state[String(vals[i][0])] = { row: i + 1, bat: String(vals[i][1]).toUpperCase() === 'TRUE', ngay_bat_dau: vals[i][2] ? remFmt_(new Date(vals[i][2])) : '' };
  }
  return { sheet: sh, state: state };
}

function remGetRules_() {
  var rs = remRulesState_();
  return REMINDER_RULES.map(function (r) {
    var st = rs.state[r.id];
    return { id: r.id, ten: r.ten, nguoi_nhan: r.nguoi_nhan, bat: !!(st && st.bat), ngay_bat_dau: st ? st.ngay_bat_dau : '' };
  });
}

function remSetRule_(user, data) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ quản trị được bật/tắt quy tắc' };
  var id = String((data && data.id) || '');
  if (!REMINDER_RULES.some(function (r) { return r.id === id; })) return { status: 'error', message: 'Quy tắc không tồn tại' };
  var bat = !!(data && data.bat);
  var rs = remRulesState_();
  var cur = rs.state[id];
  var now = new Date();
  if (cur) {
    rs.sheet.getRange(cur.row, 2).setValue(bat ? 'TRUE' : 'FALSE');
    if (bat && !cur.ngay_bat_dau) rs.sheet.getRange(cur.row, 3).setValue(now);
  } else {
    rs.sheet.appendRow([id, bat ? 'TRUE' : 'FALSE', bat ? now : '']);
  }
  return { status: 'success', data: remGetRules_() };
}

function remUsers_() {
  var s = authGetSheet_();
  var vals = s.sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var o = {};
    s.headers.forEach(function (h, idx) { o[h] = vals[i][idx]; });
    if (!o.TenDangNhap) continue;
    out.push({
      username: String(o.TenDangNhap).trim(), maNV: String(o.MaNV || '').trim(), ten: String(o.TenNV || '').trim(),
      to: String(o.To || '').trim(), email: String(o.Email || '').trim(), role: authNormalizeRole_(o.VaiTro)
    });
  }
  return out;
}

function remListText_(items, max) {
  var shown = items.slice(0, max).join('\n');
  return shown + (items.length > max ? '\n... và ' + (items.length - max) + ' trạm khác' : '');
}

/** Dựng danh sách tin nhắn cần gửi cho 1 quy tắc. Mỗi phần tử: {to, subject, body, so_tram, ma_trams}. */
function remBuild_(ruleId) {
  var stations = getSheetData(SHEET_NAMES.STATIONS);
  var insp = {};
  getBtsInspectionsData().forEach(function (b) { insp[String(b.id_nha_tram)] = b; });
  var users = remUsers_();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var msgs = [];

  if (ruleId === 'HET_HAN_30') {
    var byMaNV = {};
    stations.forEach(function (st) {
      var exp = remEffectiveExpiry_(st);
      if (!exp) return;
      var days = Math.round((exp.getTime() - today.getTime()) / 86400000);
      if (days < 0 || days > 30) return;
      var k = String(st.ma_nv || '').trim();
      if (!k) return;
      (byMaNV[k] = byMaNV[k] || []).push({ ma: st.ma_nha_tram, line: st.ma_nha_tram + ' - ' + st.ten_nha_tram + ' (hết hạn ' + remFmt_(exp) + ', còn ' + days + ' ngày)' });
    });
    users.forEach(function (u) {
      var list = byMaNV[u.maNV];
      if (!list || !list.length) return;
      msgs.push({
        to: u, so_tram: list.length, ma_trams: list.map(function (x) { return x.ma; }),
        subject: '[Nhà trạm] ' + list.length + ' trạm sắp hết hạn trong 30 ngày',
        body: 'Chào ' + u.ten + ',\nBạn có ' + list.length + ' trạm có giấy kiểm định/công bố sắp hết hạn trong 30 ngày tới:\n' +
          remListText_(list.map(function (x) { return '- ' + x.line; }), 15) + '\nVui lòng cập nhật giấy mới và dán niêm yết đúng hạn.'
      });
    });
  } else if (ruleId === 'CHUA_DAN_14') {
    var rs = remRulesState_().state['CHUA_DAN_14'];
    if (!rs || !rs.ngay_bat_dau) return msgs;
    var start = remParseDate_(rs.ngay_bat_dau);
    if (!start || (today.getTime() - start.getTime()) < 14 * 86400000) return msgs;
    var byOrg = {};
    stations.forEach(function (st) {
      var exp = remEffectiveExpiry_(st);
      if (!exp || exp.getFullYear() > REMINDER_YEAR) return;
      var ins = insp[String(st.id_nha_tram)];
      if (ins && ins.trang_thai === 'Đã dán') return;
      (byOrg[st.to_ha_tang] = byOrg[st.to_ha_tang] || []).push(st);
    });
    users.forEach(function (u) {
      if (u.role !== 'totruong') return;
      var list = byOrg[u.to];
      if (!list || !list.length) return;
      var perEmp = {};
      list.forEach(function (st) { perEmp[st.nguoi_phu_trach] = (perEmp[st.nguoi_phu_trach] || 0) + 1; });
      var lines = Object.keys(perEmp).map(function (k) { return '- ' + k + ': ' + perEmp[k] + ' trạm'; });
      msgs.push({
        to: u, so_tram: list.length, ma_trams: list.map(function (st) { return st.ma_nha_tram; }),
        subject: '[Nhà trạm] ' + list.length + ' trạm đến hạn ' + REMINDER_YEAR + ' chưa dán sau 14 ngày',
        body: 'Chào ' + u.ten + ',\nTổ ' + u.to + ' còn ' + list.length + ' trạm đến hạn dán lại ' + REMINDER_YEAR + ' chưa dán sau 14 ngày kể từ ' + remFmt_(start) + ':\n' + lines.join('\n') + '\nĐề nghị đôn đốc nhân viên thực hiện.'
      });
    });
  } else if (ruleId === 'TON_CUOI_TUAN') {
    var perOrg = {}, totalLeft = 0, codes = [];
    stations.forEach(function (st) {
      var exp = remEffectiveExpiry_(st);
      if (!exp || exp.getFullYear() > REMINDER_YEAR) return;
      var ins = insp[String(st.id_nha_tram)];
      if (ins && ins.trang_thai === 'Đã dán') return;
      perOrg[st.to_ha_tang] = (perOrg[st.to_ha_tang] || 0) + 1;
      totalLeft++; codes.push(st.ma_nha_tram);
    });
    if (totalLeft === 0) return msgs;
    var orgLines = Object.keys(perOrg).sort().map(function (k) { return '- ' + k + ': ' + perOrg[k] + ' trạm'; });
    users.forEach(function (u) {
      if (u.role !== 'admin') return;
      msgs.push({
        to: u, so_tram: totalLeft, ma_trams: codes,
        subject: '[Nhà trạm] Tồn việc cuối tuần: ' + totalLeft + ' trạm đến hạn ' + REMINDER_YEAR + ' chưa dán',
        body: 'Chào ' + u.ten + ',\nTồn việc cuối tuần - số trạm đến hạn dán lại ' + REMINDER_YEAR + ' chưa dán theo Tổ:\n' + orgLines.join('\n')
      });
    });
  }
  return msgs;
}

function remLog_(rows) {
  if (!rows.length) return;
  var sh = remSheet_(REM_HISTORY_SHEET, REM_HISTORY_HEADERS);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, REM_HISTORY_HEADERS.length).setValues(rows);
}

function remRow_(ruleId, m, kenh, status, user) {
  var u = user || m.to;
  return [
    Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm:ss'), ruleId, u.username, u.ten, u.email,
    m.so_tram, kenh, m.subject, m.body, m.ma_trams.join(', ').slice(0, 45000), status
  ];
}

function remPreview_(user, data) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ quản trị xem trước nhắc việc' };
  var msgs = remBuild_(String(data && data.id));
  return {
    status: 'success',
    data: msgs.map(function (m) {
      return { username: m.to.username, ten: m.to.ten, email: m.to.email, so_tram: m.so_tram, subject: m.subject, body: m.body, ma_trams: m.ma_trams };
    })
  };
}

/**
 * Gửi nhắc. test=true: chỉ gửi 1 tin mẫu tới email của chính người bấm, không động tới nhân viên.
 * test=false: gửi email thật tới từng người nhận và ghi thông báo trong app.
 */
function remSend_(user, data) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ quản trị được gửi nhắc việc' };
  var id = String(data && data.id);
  var msgs = remBuild_(id);
  if (!msgs.length) return { status: 'success', data: { sent: 0, message: 'Không có ai cần nhắc theo quy tắc này' } };

  if (data && data.test) {
    if (!user.email) return { status: 'error', message: 'Tài khoản của bạn chưa có email trong sheet NguoiDung' };
    var m0 = msgs[0];
    MailApp.sendEmail(user.email, '[GỬI THỬ] ' + m0.subject, '(Tin gửi thử, mẫu của ' + m0.to.ten + ')\n\n' + m0.body);
    remLog_([remRow_(id, m0, 'Gửi thử', 'Đã gửi', user)]);
    return { status: 'success', data: { sent: 1, message: 'Đã gửi thử tới ' + user.email } };
  }

  return { status: 'success', data: remSendReal_(id, msgs) };
}

function remSendReal_(id, msgs) {
  var quota = MailApp.getRemainingDailyQuota();
  var rows = [], sent = 0, failed = 0;
  msgs.forEach(function (m) {
    var kenh = 'Trong app', status = 'Đã tạo thông báo';
    if (m.to.email && quota - sent > 0) {
      try {
        MailApp.sendEmail(m.to.email, m.subject, m.body);
        kenh = 'Email + trong app'; status = 'Đã gửi'; sent++;
      } catch (e) {
        failed++; status = 'Lỗi email: ' + String(e).slice(0, 80);
      }
    } else if (!m.to.email) {
      status = 'Thiếu email, chỉ thông báo trong app';
    } else {
      status = 'Hết hạn mức email trong ngày, chỉ thông báo trong app';
    }
    rows.push(remRow_(id, m, kenh, status));
  });
  remLog_(rows);
  return { sent: sent, failed: failed, total: msgs.length, message: 'Đã gửi ' + sent + '/' + msgs.length + ' email, tất cả đều có thông báo trong app' };
}

/** Đọc lịch sử: admin tất cả; người khác chỉ thông báo của mình. */
function remHistory_(user, mineOnly) {
  var sh = remSheet_(REM_HISTORY_SHEET, REM_HISTORY_HEADERS);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var n = Math.min(300, last - 1);
  var vals = sh.getRange(last - n + 1, 1, n, REM_HISTORY_HEADERS.length).getValues();
  var out = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var o = {};
    REM_HISTORY_HEADERS.forEach(function (h, idx) { o[h] = vals[i][idx]; });
    if ((user.role === 'admin' && !mineOnly) || String(o.nguoi_nhan) === user.username) {
      if (o.kenh === 'Gửi thử' && String(o.nguoi_nhan) !== user.username) continue;
      out.push(o);
    }
  }
  return out;
}

/** Hàm chạy theo lịch hằng ngày (trigger): chỉ gửi các quy tắc đang BẬT. Quy tắc cuối tuần chỉ chạy thứ Sáu. */
function runScheduledReminders() {
  var rules = remGetRules_();
  var dow = Number(Utilities.formatDate(new Date(), 'GMT+7', 'u')); // 1=Thứ Hai ... 5=Thứ Sáu
  rules.forEach(function (r) {
    if (!r.bat) return;
    if (r.id === 'TON_CUOI_TUAN' && dow !== 5) return;
    remSendReal_(r.id, remBuild_(r.id));
  });
}

function remSetTrigger_(user, data) {
  if (user.role !== 'admin') return { status: 'error', code: 'FORBIDDEN', message: 'Chỉ quản trị được cấu hình lịch tự động' };
  var on = !!(data && data.on);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runScheduledReminders') ScriptApp.deleteTrigger(t);
  });
  if (on) ScriptApp.newTrigger('runScheduledReminders').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Ho_Chi_Minh').create();
  return { status: 'success', data: { on: on } };
}

function remTriggerOn_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'runScheduledReminders'; });
}
