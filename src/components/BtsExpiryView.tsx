import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlarmClock, Download } from 'lucide-react';
import { Station } from '../types';
import { logEvent } from '../services/auth';
import { getEffectiveExpiry, formatVnDate } from '../utils/btsDates';

interface Props {
  stations: Station[];
}

type Level = 'Đã hết hạn' | 'Trong 30 ngày' | '31–60 ngày' | '61–90 ngày';

const DAY = 86400000;

const levelOf = (days: number): Level | null => {
  if (days < 0) return 'Đã hết hạn';
  if (days <= 30) return 'Trong 30 ngày';
  if (days <= 60) return '31–60 ngày';
  if (days <= 90) return '61–90 ngày';
  return null;
};

const LEVEL_STYLE: Record<Level, string> = {
  'Đã hết hạn': 'bg-red-100 text-red-700',
  'Trong 30 ngày': 'bg-orange-100 text-orange-700',
  '31–60 ngày': 'bg-amber-100 text-amber-700',
  '61–90 ngày': 'bg-sky-100 text-sky-700'
};

export const BtsExpiryView: React.FC<Props> = ({ stations }) => {
  const [org, setOrg] = useState('');
  const [employee, setEmployee] = useState('');
  const [level, setLevel] = useState<Level | ''>('');

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const rows = useMemo(
    () =>
      stations
        .map(s => {
          const expiry = getEffectiveExpiry(s);
          if (!expiry) return null;
          const days = Math.round((expiry.getTime() - today.getTime()) / DAY);
          return { s, expiry, days, level: levelOf(days) };
        })
        .filter((r): r is NonNullable<typeof r> => !!r),
    [stations, today]
  );

  const counts = useMemo(() => {
    const c: Record<Level, number> = { 'Đã hết hạn': 0, 'Trong 30 ngày': 0, '31–60 ngày': 0, '61–90 ngày': 0 };
    rows.forEach(r => r.level && c[r.level]++);
    return c;
  }, [rows]);

  // Biểu đồ: từ năm hiện tại đến năm xa nhất có trong dữ liệu
  const chartData = useMemo(() => {
    const thisYear = today.getFullYear();
    const byYear = new Map<number, number>();
    let maxYear = thisYear;
    rows.forEach(r => {
      const y = r.expiry.getFullYear();
      if (y < thisYear) return;
      maxYear = Math.max(maxYear, y);
      byYear.set(y, (byYear.get(y) || 0) + 1);
    });
    const out: { year: string; count: number; current: boolean }[] = [];
    for (let y = thisYear; y <= maxYear; y++) out.push({ year: String(y), count: byYear.get(y) || 0, current: y === thisYear });
    return out;
  }, [rows, today]);

  const orgs = useMemo(() => Array.from(new Set(stations.map(s => s.to_ha_tang).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')), [stations]);
  const employees = useMemo(
    () =>
      Array.from(new Set(stations.filter(s => !org || s.to_ha_tang === org).map(s => s.nguoi_phu_trach).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'vi')
      ),
    [stations, org]
  );

  const list = useMemo(
    () =>
      rows
        .filter(r => r.level && (!level || r.level === level) && (!org || r.s.to_ha_tang === org) && (!employee || r.s.nguoi_phu_trach === employee))
        .sort((a, b) => a.days - b.days),
    [rows, level, org, employee]
  );

  const exportExcel = () => {
    const data = list.map(r => ({
      'Mã trạm': r.s.ma_nha_tram,
      'Tên trạm': r.s.ten_nha_tram,
      Tổ: r.s.to_ha_tang,
      'Nhân viên': r.s.nguoi_phu_trach,
      'Ngày hết hạn': formatVnDate(r.expiry),
      'Số ngày còn lại': r.days,
      'Mức cảnh báo': r.level
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Sap_het_han');
    XLSX.writeFile(wb, `Tram_sap_het_han_${new Date().toISOString().split('T')[0]}.xlsx`);
    logEvent('Xuất báo cáo', `Trạm sắp hết hạn (${list.length} dòng)`);
  };

  const levels: Level[] = ['Đã hết hạn', 'Trong 30 ngày', '31–60 ngày', '61–90 ngày'];
  const select = 'px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <AlarmClock className="w-6 h-6 text-vnpt-600" /> Lịch hết hạn và cảnh báo
        </h2>
        <p className="text-sm text-slate-500 mt-1">Theo ngày hết hạn xa hơn giữa giấy kiểm định và bản công bố của từng trạm.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {levels.map(l => (
          <button
            key={l}
            onClick={() => setLevel(level === l ? '' : l)}
            className={`text-left bg-white rounded-2xl p-4 border shadow-xs ${level === l ? 'border-vnpt-600 ring-2 ring-vnpt-200' : 'border-slate-200'}`}
          >
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${LEVEL_STYLE[l]}`}>{l === 'Trong 30 ngày' ? 'Hết hạn trong 30 ngày' : l}</span>
            <div className="text-2xl font-extrabold text-slate-800 mt-2">{counts[l].toLocaleString('vi-VN')}</div>
            <div className="text-xs text-slate-500">trạm</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-3">Số trạm hết hạn theo năm</h3>
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`${v} trạm`, 'Hết hạn']} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {chartData.map(d => (
                  <Cell key={d.year} fill={d.current ? '#f59e0b' : '#38bdf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-400 mt-1">Cột màu cam là năm hiện tại.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-slate-700 text-sm mr-auto">Trạm sắp hết hạn ({list.length})</h3>
          <select className={select} value={org} onChange={e => { setOrg(e.target.value); setEmployee(''); }}>
            <option value="">Tất cả Tổ</option>
            {orgs.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className={select} value={employee} onChange={e => setEmployee(e.target.value)}>
            <option value="">Tất cả nhân viên</option>
            {employees.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <button onClick={exportExcel} className="flex items-center gap-1 px-3 py-2 rounded-xl bg-vnpt-600 text-white text-sm font-bold">
            <Download className="w-4 h-4" /> Xuất Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-2">Mã trạm</th>
                <th className="text-left p-2">Tên trạm</th>
                <th className="text-left p-2">Tổ</th>
                <th className="text-left p-2">Ngày hết hạn</th>
                <th className="text-right p-2">Còn lại (ngày)</th>
                <th className="text-left p-2">Mức cảnh báo</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 300).map(r => (
                <tr key={r.s.id_nha_tram} className="border-t border-slate-100">
                  <td className="p-2 font-mono text-xs">{r.s.ma_nha_tram}</td>
                  <td className="p-2">{r.s.ten_nha_tram}<div className="text-xs text-slate-400">{r.s.nguoi_phu_trach}</div></td>
                  <td className="p-2">{r.s.to_ha_tang}</td>
                  <td className="p-2">{formatVnDate(r.expiry)}</td>
                  <td className="p-2 text-right font-semibold">{r.days}</td>
                  <td className="p-2"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${LEVEL_STYLE[r.level!]}`}>{r.level}</span></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-400">Không có trạm nào</td></tr>}
            </tbody>
          </table>
          {list.length > 300 && <p className="text-xs text-slate-400 p-2">Hiển thị 300 trạm đầu; dùng "Xuất Excel" để lấy đủ {list.length} trạm.</p>}
        </div>
      </div>
    </div>
  );
};
