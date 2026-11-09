import React, { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, AlertTriangle, ListChecks, Building2, Info } from 'lucide-react';
import { Station, BtsInspection } from '../types';

interface Props {
  stations: Station[];
  btsInspections: BtsInspection[];
}

// Backend trả ngày dạng dd/MM/yyyy
const parseVnDate = (s?: string): Date | null => {
  if (!s) return null;
  const [day, month, year] = String(s).trim().split(/[\/\-]/).map(Number);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
};

const YEAR = 2026;

/**
 * Ngày hết hạn hiệu lực của trạm = ngày hết hạn XA HƠN giữa giấy kiểm định và bản công bố
 * (cùng quy tắc "ưu tiên giấy còn hạn lâu hơn" đang dùng ở tab Công bố kiểm định BTS).
 * Trả về null nếu trạm không có ngày hết hạn nào.
 */
const getEffectiveExpiry = (s: Station): Date | null => {
  const a = s.GCN_kiem_dinh ? parseVnDate(s.ngay_het_han_kiem_dinh) : null;
  const b = s.GCN_cong_bo ? parseVnDate(s.ngay_het_han_cong_bo) : null;
  if (a && b) return a.getTime() >= b.getTime() ? a : b;
  return a || b;
};

interface Row {
  station: Station;
  expiry: Date | null;
  done: boolean;
  expired: boolean;
  q4: boolean;
}

export const BtsDueView: React.FC<Props> = ({ stations, btsInspections }) => {
  const [onlyQ4, setOnlyQ4] = useState(false);
  const [onlyExpired, setOnlyExpired] = useState(false);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const inspMap = useMemo(() => {
    const m = new Map<string, BtsInspection>();
    btsInspections.forEach(b => m.set(b.id_nha_tram, b));
    return m;
  }, [btsInspections]);

  const { dueRows, noCert } = useMemo(() => {
    const due: Row[] = [];
    let missing = 0;
    const endOfYear = new Date(YEAR, 11, 31);
    stations.forEach(s => {
      const expiry = getEffectiveExpiry(s);
      if (!expiry) {
        if (!s.GCN_kiem_dinh && !s.GCN_cong_bo) missing++;
        return;
      }
      // Đến hạn 2026 = đã hết hạn hoặc hết hạn trong năm 2026; giấy còn hạn sang 2027+ không tính
      if (expiry.getTime() > endOfYear.getTime()) return;
      const insp = inspMap.get(s.id_nha_tram);
      due.push({
        station: s,
        expiry,
        done: insp?.trang_thai === 'Đã dán',
        expired: expiry.getTime() < today.getTime() || insp?.han_kiem_dinh === 'Hết hạn',
        q4: expiry.getFullYear() === YEAR && expiry.getMonth() >= 9
      });
    });
    return { dueRows: due, noCert: missing };
  }, [stations, inspMap, today]);

  const filtered = useMemo(
    () => dueRows.filter(r => (!onlyQ4 || r.q4) && (!onlyExpired || r.expired)),
    [dueRows, onlyQ4, onlyExpired]
  );

  const byOrg = useMemo(() => {
    const map = new Map<string, { due: number; done: number }>();
    filtered.forEach(r => {
      const k = r.station.to_ha_tang || 'Chưa phân tổ';
      const o = map.get(k) || { due: 0, done: 0 };
      o.due++;
      if (r.done) o.done++;
      map.set(k, o);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [filtered]);

  const due = filtered.length;
  const done = filtered.filter(r => r.done).length;
  const remaining = due - done;

  const Card = ({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) => (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
      <div className={`inline-flex p-2 rounded-xl ${tone}`}><Icon className="w-5 h-5" /></div>
      <div className="text-2xl font-extrabold text-slate-800 mt-2">{value.toLocaleString('vi-VN')}</div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-bold border ${active ? 'bg-vnpt-600 text-white border-vnpt-600' : 'bg-white text-slate-600 border-slate-300'}`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800">Đến hạn dán lại {YEAR}</h2>
        <p className="text-sm text-slate-500 mt-1">Chỉ tiêu dán lại giấy kiểm định/công bố trong năm {YEAR}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Tổng số trạm quản lý" value={stations.length} icon={Building2} tone="bg-sky-100 text-sky-700" />
        <Card label={`Đến hạn dán lại ${YEAR}`} value={due} icon={CalendarClock} tone="bg-amber-100 text-amber-700" />
        <Card label="Đã dán" value={done} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <Card label="Còn phải dán" value={remaining} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={chip(true)}>Năm {YEAR}</span>
        <button className={chip(onlyQ4)} onClick={() => setOnlyQ4(!onlyQ4)}>Quý IV/{YEAR}</button>
        <button className={chip(onlyExpired)} onClick={() => setOnlyExpired(!onlyExpired)}>Chỉ trạm đã hết hạn</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Tổ</th>
              <th className="text-right p-3">Đến hạn</th>
              <th className="text-right p-3">Đã dán</th>
              <th className="text-right p-3">Còn phải dán</th>
              <th className="p-3 min-w-[140px]">Tiến độ</th>
              <th className="text-right p-3">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {byOrg.map(([org, o]) => {
              const pct = o.due ? Math.round((o.done / o.due) * 100) : 0;
              return (
                <tr key={org} className="border-t border-slate-100">
                  <td className="p-3 font-semibold text-slate-700">{org}</td>
                  <td className="p-3 text-right">{o.due}</td>
                  <td className="p-3 text-right text-emerald-700">{o.done}</td>
                  <td className="p-3 text-right text-red-600">{o.due - o.done}</td>
                  <td className="p-3">
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="p-3 text-right font-bold">{pct}%</td>
                </tr>
              );
            })}
            {byOrg.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-slate-400">Không có trạm nào thỏa bộ lọc</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start space-x-2 p-3 rounded-xl bg-sky-50 text-sky-800 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Cách tính:</b> trạm "đến hạn {YEAR}" là trạm có ngày hết hạn (lấy giấy còn hạn lâu hơn giữa kiểm định và công
          bố) đã qua hoặc rơi trong năm {YEAR}. Giấy còn hạn sang {YEAR + 1} trở đi không tính. "Đã dán" là trạm có
          trạng thái Đã dán ở tab Công bố kiểm định BTS. Có <b>{noCert}</b> trạm chưa có số giấy nào, chưa được tính vào
          chỉ tiêu vì dữ liệu hiện không có cờ "hư hỏng/cần dán lại". Khác với chỉ tiêu "Phải thực hiện" ở Báo cáo kiểm
          định (= tổng trạm trừ đã dán).
        </div>
      </div>
    </div>
  );
};
