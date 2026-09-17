import React, { useMemo, useState } from 'react';
import { BarChart3, Building2, Trophy, CheckCircle2, FileImage } from 'lucide-react';
import { Station, BtsInspection } from '../types';

interface BtsReportViewProps {
  stations: Station[];
  btsInspections: BtsInspection[];
}

interface OrgStat {
  orgName: string;
  total: number;
  done: number;
  pending: number;
  expired: number;
}

interface EmployeeStat {
  name: string;
  ma_nv?: string;
  total: number;
  done: number;
  pending: number;
  expired: number;
  filesCount: number;
}

export const BtsReportView: React.FC<BtsReportViewProps> = ({ stations, btsInspections }) => {
  const inspectionByStation = useMemo(() => {
    const map = new Map<string, BtsInspection>();
    btsInspections.forEach(b => map.set(b.id_nha_tram, b));
    return map;
  }, [btsInspections]);

  const orgGroups = useMemo(() => {
    const map = new Map<string, Station[]>();
    stations.forEach(s => {
      const key = s.to_ha_tang || 'Chưa phân tổ';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [stations]);

  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const activeOrg = selectedOrg || orgGroups[0]?.[0] || '';

  const orgStats: OrgStat[] = useMemo(() => {
    return orgGroups.map(([orgName, orgStations]) => {
      let done = 0;
      let expired = 0;
      orgStations.forEach(s => {
        const insp = inspectionByStation.get(s.id_nha_tram);
        if (insp?.trang_thai === 'Đã dán') done++;
        if (insp?.han_kiem_dinh === 'Hết hạn') expired++;
      });
      return {
        orgName,
        total: orgStations.length,
        done,
        pending: orgStations.length - done,
        expired
      };
    });
  }, [orgGroups, inspectionByStation]);

  const grandTotal = useMemo(() => {
    return orgStats.reduce(
      (acc, o) => ({
        total: acc.total + o.total,
        done: acc.done + o.done,
        pending: acc.pending + o.pending,
        expired: acc.expired + o.expired
      }),
      { total: 0, done: 0, pending: 0, expired: 0 }
    );
  }, [orgStats]);

  const employeeStatsForActiveOrg: EmployeeStat[] = useMemo(() => {
    const orgStations = orgGroups.find(([name]) => name === activeOrg)?.[1] || [];
    const map = new Map<string, EmployeeStat>();
    orgStations.forEach(s => {
      const key = s.nguoi_phu_trach || 'Chưa phân công';
      if (!map.has(key)) {
        map.set(key, { name: key, ma_nv: s.ma_nv, total: 0, done: 0, pending: 0, expired: 0, filesCount: 0 });
      }
      const stat = map.get(key)!;
      stat.total++;
      const insp = inspectionByStation.get(s.id_nha_tram);
      if (insp?.trang_thai === 'Đã dán') stat.done++;
      else stat.pending++;
      if (insp?.han_kiem_dinh === 'Hết hạn') stat.expired++;
      stat.filesCount += insp?.anh_niem_yet_list?.length || 0;
    });
    return Array.from(map.values()).sort((a, b) => b.done - a.done || b.filesCount - a.filesCount);
  }, [orgGroups, activeOrg, inspectionByStation]);

  const leaderboard = useMemo(() => {
    const map = new Map<string, EmployeeStat & { orgName: string }>();
    stations.forEach(s => {
      const key = `${s.ma_nv || s.nguoi_phu_trach}__${s.to_ha_tang}`;
      if (!map.has(key)) {
        map.set(key, {
          name: s.nguoi_phu_trach || 'Chưa phân công',
          ma_nv: s.ma_nv,
          orgName: s.to_ha_tang || 'Chưa phân tổ',
          total: 0,
          done: 0,
          pending: 0,
          expired: 0,
          filesCount: 0
        });
      }
      const stat = map.get(key)!;
      stat.total++;
      const insp = inspectionByStation.get(s.id_nha_tram);
      if (insp?.trang_thai === 'Đã dán') stat.done++;
      else stat.pending++;
      if (insp?.han_kiem_dinh === 'Hết hạn') stat.expired++;
      stat.filesCount += insp?.anh_niem_yet_list?.length || 0;
    });
    return Array.from(map.values())
      .filter(s => s.filesCount > 0)
      .sort((a, b) => b.filesCount - a.filesCount || b.done - a.done)
      .slice(0, 10);
  }, [stations, inspectionByStation]);

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-vnpt-600" />
          <span>Báo cáo kiểm định BTS</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Thống kê tiến độ dán niêm yết kiểm định theo từng Tổ Hạ tầng, từng nhân viên và xếp hạng người gắn file nhiều nhất.
        </p>
      </div>

      {/* Tổng quan toàn Trung tâm */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80">
          <div className="text-2xl font-black text-slate-800">{grandTotal.total}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Tổng số trạm</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-200/80">
          <div className="text-2xl font-black text-emerald-600">{grandTotal.done}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Đã dán niêm yết</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200/80">
          <div className="text-2xl font-black text-amber-600">{grandTotal.pending}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Phải thực hiện</div>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-200/80">
          <div className="text-2xl font-black text-rose-600">{grandTotal.expired}</div>
          <div className="text-xs font-semibold text-slate-500 mt-0.5">Trạm hết hạn</div>
        </div>
      </div>

      {/* Bảng thống kê theo từng Tổ Hạ tầng */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-vnpt-600" />
            <span>Thống kê theo Tổ Hạ tầng</span>
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Tổ Hạ tầng</th>
                <th className="px-4 py-2.5 text-right">Tổng số trạm</th>
                <th className="px-4 py-2.5 text-right">Phải thực hiện</th>
                <th className="px-4 py-2.5 text-right">Đã dán</th>
                <th className="px-4 py-2.5 text-right">Hết hạn</th>
                <th className="px-4 py-2.5 text-right">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orgStats.map(o => (
                <tr
                  key={o.orgName}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${activeOrg === o.orgName ? 'bg-sky-50' : ''}`}
                  onClick={() => setSelectedOrg(o.orgName)}
                >
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{o.orgName}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-700">{o.total}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-600">{o.pending}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{o.done}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-rose-600">{o.expired || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-vnpt-700">{pct(o.done, o.total)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-black text-slate-800">
                <td className="px-4 py-2.5">Tổng cộng</td>
                <td className="px-4 py-2.5 text-right">{grandTotal.total}</td>
                <td className="px-4 py-2.5 text-right text-amber-600">{grandTotal.pending}</td>
                <td className="px-4 py-2.5 text-right text-emerald-600">{grandTotal.done}</td>
                <td className="px-4 py-2.5 text-right text-rose-600">{grandTotal.expired || '-'}</td>
                <td className="px-4 py-2.5 text-right text-vnpt-700">{pct(grandTotal.done, grandTotal.total)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bảng chi tiết từng nhân viên trong 1 tổ */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-vnpt-600" />
            <span>Chi tiết theo nhân viên</span>
          </h3>
          <select
            value={activeOrg}
            onChange={e => setSelectedOrg(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-vnpt-500"
          >
            {orgGroups.map(([orgName]) => (
              <option key={orgName} value={orgName}>{orgName}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5">Nhân viên</th>
                <th className="px-4 py-2.5 text-right">Tổng trạm</th>
                <th className="px-4 py-2.5 text-right">Đã dán</th>
                <th className="px-4 py-2.5 text-right">Phải thực hiện</th>
                <th className="px-4 py-2.5 text-right">Hết hạn</th>
                <th className="px-4 py-2.5 text-right">Số file</th>
                <th className="px-4 py-2.5 text-right">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employeeStatsForActiveOrg.map(emp => (
                <tr key={emp.name} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-800">{emp.name}</div>
                    {emp.ma_nv && <div className="text-[11px] text-slate-400 font-medium">{emp.ma_nv}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-700">{emp.total}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{emp.done}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-600">{emp.pending}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-rose-600">{emp.expired || '-'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-600">{emp.filesCount}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-vnpt-700">{pct(emp.done, emp.total)}%</td>
                </tr>
              ))}
              {employeeStatsForActiveOrg.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-semibold">
                    Không có dữ liệu nhân viên cho tổ này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Xếp hạng Top 10 người gắn file nhiều nhất */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Top 10 người gắn file nhiều nhất</span>
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {leaderboard.map((p, idx) => (
            <div key={`${p.ma_nv}-${p.orgName}`} className="flex items-center gap-3 px-5 py-3">
              <span className={`w-7 h-7 shrink-0 rounded-full font-black text-xs flex items-center justify-center ${
                idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-amber-700/30 text-amber-900' : 'bg-slate-100 text-slate-500'
              }`}>
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 text-sm truncate">{p.name}</div>
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  {p.ma_nv ? `${p.ma_nv} • ` : ''}{p.orgName}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                <FileImage className="w-3.5 h-3.5" />
                <span className="font-black text-xs">{p.filesCount}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 shrink-0 text-xs font-semibold w-16 justify-end">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {p.done}/{p.total}
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 font-semibold text-sm">
              Chưa có ai gắn file niêm yết kiểm định.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
