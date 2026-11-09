import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ScrollText, Download, Loader2 } from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { apiPost, logEvent } from '../services/auth';
import { parseVnDate } from '../utils/btsDates';

interface Props {
  stations: Station[];
  btsInspections: BtsInspection[];
}

interface LogRow {
  thoi_diem: string;
  tai_khoan: string;
  ten_nv: string;
  to_ha_tang: string;
  ma_tram: string;
  loai_thao_tac: string;
  chi_tiet: string;
  thoi_gian_xu_ly_giay: number | string;
  ket_qua: string;
}

const DAY = 86400000;

// "dd/MM/yyyy HH:mm:ss" -> Date
const parseStamp = (s: string): Date | null => {
  const parts = String(s).split(' ');
  const d = parseVnDate(parts[0]);
  if (!d) return null;
  if (parts[1]) {
    const [h, m, sec] = parts[1].split(':').map(Number);
    d.setHours(h || 0, m || 0, sec || 0);
  }
  return d;
};

const toInputDate = (d: Date) => d.toISOString().split('T')[0];

export const AuditLogView: React.FC<Props> = ({ stations, btsInspections }) => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [org, setOrg] = useState('');
  const [person, setPerson] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let alive = true;
    apiPost('getAuditLog')
      .then(json => {
        if (!alive) return;
        if (json.status === 'success') setRows(json.data || []);
        else setError(json.message || 'Không tải được nhật ký');
      })
      .catch(() => alive && setError('Không kết nối được máy chủ'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const now = Date.now();
  const startOfToday = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t.getTime();
  }, []);

  const stats = useMemo(() => {
    const today = rows.filter(r => (parseStamp(r.thoi_diem)?.getTime() || 0) >= startOfToday).length;
    const durations = rows
      .filter(r => r.ket_qua === 'Thành công' && Number(r.thoi_gian_xu_ly_giay) > 0 && r.ma_tram)
      .map(r => Number(r.thoi_gian_xu_ly_giay));
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const errors = rows.filter(r => r.ket_qua !== 'Thành công').length;
    return { today, avg, errors, measured: durations.length };
  }, [rows, startOfToday]);

  // Trạm chưa có cập nhật nào quá 30 ngày (hoặc chưa từng cập nhật)
  const staleStations = useMemo(() => {
    const lastUpdate = new Map<string, number>();
    btsInspections.forEach(b => {
      const d = b.thoi_diem_cap_nhat ? parseStamp(b.thoi_diem_cap_nhat) : null;
      if (d) lastUpdate.set(b.id_nha_tram, d.getTime());
    });
    return stations.filter(s => {
      const t = lastUpdate.get(s.id_nha_tram);
      return !t || now - t > 30 * DAY;
    }).length;
  }, [stations, btsInspections, now]);

  const orgs = useMemo(() => Array.from(new Set(rows.map(r => r.to_ha_tang).filter(Boolean))).sort(), [rows]);
  const people = useMemo(
    () => Array.from(new Set(rows.filter(r => !org || r.to_ha_tang === org).map(r => r.ten_nv).filter(Boolean))).sort(),
    [rows, org]
  );

  const filtered = useMemo(() => {
    const f = from ? new Date(from + 'T00:00:00').getTime() : -Infinity;
    const t = to ? new Date(to + 'T23:59:59').getTime() : Infinity;
    return rows.filter(r => {
      const ts = parseStamp(r.thoi_diem)?.getTime() || 0;
      return ts >= f && ts <= t && (!org || r.to_ha_tang === org) && (!person || r.ten_nv === person);
    });
  }, [rows, org, person, from, to]);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        filtered.map(r => ({
          'Thời điểm': r.thoi_diem,
          'Tài khoản': r.tai_khoan,
          'Người thực hiện': r.ten_nv,
          Tổ: r.to_ha_tang,
          'Mã trạm': r.ma_tram,
          'Thao tác': r.loai_thao_tac,
          'Chi tiết': r.chi_tiet,
          'Thời gian xử lý (giây)': r.thoi_gian_xu_ly_giay,
          'Kết quả': r.ket_qua
        }))
      ),
      'Nhat_ky'
    );
    XLSX.writeFile(wb, `Nhat_ky_thao_tac_${toInputDate(new Date())}.xlsx`);
    logEvent('Xuất báo cáo', `Nhật ký thao tác (${filtered.length} dòng)`);
  };

  const card = (label: string, value: string, hint?: string) => (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
      <div className="text-2xl font-extrabold text-slate-800">{value}</div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
  const input = 'px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-vnpt-600" /> Nhật ký thao tác
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Chỉ ghi thêm, không sửa/xóa. Nhân viên chỉ thấy thao tác của mình, tổ trưởng thấy cả Tổ.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {card('Thao tác hôm nay', String(stats.today))}
        {card(
          'Thời gian xử lý TB / trạm',
          stats.avg === null ? '—' : `${stats.avg.toFixed(1)} giây`,
          `đo trên ${stats.measured} thao tác`
        )}
        {card('Trạm chưa cập nhật quá 30 ngày', String(staleStations))}
        {card('Thao tác lỗi', String(stats.errors))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-700 text-sm mr-auto">Nhật ký gần nhất ({filtered.length})</h3>
          <select className={input} value={org} onChange={e => { setOrg(e.target.value); setPerson(''); }}>
            <option value="">Tất cả Tổ</option>
            {orgs.map(o => <option key={o}>{o}</option>)}
          </select>
          <select className={input} value={person} onChange={e => setPerson(e.target.value)}>
            <option value="">Tất cả người</option>
            {people.map(o => <option key={o}>{o}</option>)}
          </select>
          <input type="date" className={input} value={from} onChange={e => setFrom(e.target.value)} aria-label="Từ ngày" />
          <input type="date" className={input} value={to} onChange={e => setTo(e.target.value)} aria-label="Đến ngày" />
          <button onClick={exportExcel} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-vnpt-600 text-white text-sm font-bold">
            <Download className="w-4 h-4" /> Xuất Excel
          </button>
        </div>

        {loading && <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Thời điểm</th>
                  <th className="text-left p-2">Người thực hiện</th>
                  <th className="text-left p-2">Mã trạm</th>
                  <th className="text-left p-2">Thao tác</th>
                  <th className="text-right p-2">Xử lý (giây)</th>
                  <th className="text-left p-2">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 300).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="p-2 whitespace-nowrap">{r.thoi_diem}</td>
                    <td className="p-2">{r.ten_nv}<div className="text-xs text-slate-400">{r.tai_khoan}</div></td>
                    <td className="p-2 font-mono text-xs">{r.ma_tram}</td>
                    <td className="p-2">{r.loai_thao_tac}{r.chi_tiet && <div className="text-xs text-slate-400">{r.chi_tiet}</div>}</td>
                    <td className="p-2 text-right">{r.thoi_gian_xu_ly_giay === '' ? '—' : r.thoi_gian_xu_ly_giay}</td>
                    <td className="p-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.ket_qua === 'Thành công' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.ket_qua}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Chưa có thao tác nào</td></tr>}
              </tbody>
            </table>
            {filtered.length > 300 && <p className="text-xs text-slate-400 p-2">Hiển thị 300 dòng đầu; xuất Excel để lấy đủ.</p>}
          </div>
        )}
        <p className="text-[11px] text-slate-400">
          Thời gian xử lý là thời gian máy chủ xử lý yêu cầu lưu (chưa gồm thời gian người dùng thao tác trước khi bấm lưu).
        </p>
      </div>
    </div>
  );
};
