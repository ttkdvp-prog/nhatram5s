import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { ClipboardList, Download, CheckCircle2, AlertTriangle, ImageOff, FileText } from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { logEvent } from '../services/auth';
import { parseVnDate, getEffectiveExpiry, formatVnDate } from '../utils/btsDates';

interface Props {
  stations: Station[];
  btsInspections: BtsInspection[];
}

const SINCE_YEAR = 2026;

interface Row {
  s: Station;
  pdf: string;
  issued: Date | null;
  expiry: Date | null;
  posted: boolean;
  photos: number;
  ngayDan: string;
  source: string;
}

const issuedOf = (s: Station): Date | null => {
  const a = s.GCN_kiem_dinh ? parseVnDate(s.ngay_cap_kiem_dinh) : null;
  const b = s.GCN_cong_bo ? parseVnDate(s.ngay_cap_cong_bo) : null;
  if (a && b) return a.getTime() >= b.getTime() ? a : b;
  return a || b;
};

export const NewCertTrackingView: React.FC<Props> = ({ stations, btsInspections }) => {
  const [mode, setMode] = useState<'all' | 'upload' | 'year'>('all');
  const [org, setOrg] = useState('');
  const [status, setStatus] = useState<'' | 'posted' | 'notPosted' | 'noPhoto'>('');
  const [q, setQ] = useState('');

  const inspMap = useMemo(() => {
    const m = new Map<string, BtsInspection>();
    btsInspections.forEach(b => m.set(b.id_nha_tram, b));
    return m;
  }, [btsInspections]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    stations.forEach(s => {
      const pdf = String((s as any).link_giay_pdf || '').trim();
      const issued = issuedOf(s);
      const byYear = !!issued && issued.getFullYear() >= SINCE_YEAR;
      if (!pdf && !byYear) return;
      const insp = inspMap.get(s.id_nha_tram);
      out.push({
        s,
        pdf,
        issued,
        expiry: getEffectiveExpiry(s),
        posted: insp?.trang_thai === 'Đã dán',
        photos: insp?.anh_niem_yet_list?.length || 0,
        ngayDan: insp?.ngay_dan || '',
        source: pdf && byYear ? 'Tải PDF + cấp từ 2026' : pdf ? 'Tải PDF' : `Cấp từ ${SINCE_YEAR}`
      });
    });
    return out;
  }, [stations, inspMap]);

  const orgs = useMemo(
    () => Array.from(new Set(rows.map(r => r.s.to_ha_tang || 'Chưa phân tổ'))).sort((a, b) => a.localeCompare(b, 'vi')),
    [rows]
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter(r => {
      if (mode === 'upload' && !r.pdf) return false;
      if (mode === 'year' && !(r.issued && r.issued.getFullYear() >= SINCE_YEAR)) return false;
      if (org && (r.s.to_ha_tang || 'Chưa phân tổ') !== org) return false;
      if (status === 'posted' && !r.posted) return false;
      if (status === 'notPosted' && r.posted) return false;
      if (status === 'noPhoto' && r.photos > 0) return false;
      if (kw && !`${r.s.ma_nha_tram} ${r.s.ten_nha_tram} ${r.s.nguoi_phu_trach}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [rows, mode, org, status, q]);

  const total = filtered.length;
  const posted = filtered.filter(r => r.posted).length;
  const withPhoto = filtered.filter(r => r.photos > 0).length;
  const postedNoPhoto = filtered.filter(r => r.posted && r.photos === 0).length;

  const byOrg = useMemo(() => {
    const m = new Map<string, { total: number; posted: number; photo: number }>();
    filtered.forEach(r => {
      const k = r.s.to_ha_tang || 'Chưa phân tổ';
      const o = m.get(k) || { total: 0, posted: 0, photo: 0 };
      o.total++;
      if (r.posted) o.posted++;
      if (r.photos > 0) o.photo++;
      m.set(k, o);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [filtered]);

  const exportXlsx = () => {
    const data = filtered.map((r, i) => ({
      STT: i + 1,
      'Mã CSHT': r.s.ma_nha_tram,
      'Tên trạm': r.s.ten_nha_tram,
      'Tổ': r.s.to_ha_tang,
      'Người được giao': r.s.nguoi_phu_trach,
      'Mã NV': r.s.ma_nv || '',
      'Ngày cấp giấy': r.issued ? formatVnDate(r.issued) : '',
      'Hạn giấy': r.expiry ? formatVnDate(r.expiry) : '',
      'Đã dán niêm yết': r.posted ? 'Đã dán' : 'Chưa dán',
      'Ngày dán': r.ngayDan,
      'Số ảnh niêm yết': r.photos,
      'Link giấy PDF': r.pdf,
      'Nguồn': r.source
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giay_moi');
    XLSX.writeFile(wb, `Theo_doi_giay_moi_${new Date().toISOString().split('T')[0]}.xlsx`);
    logEvent('Xuất báo cáo', `Theo dõi giấy mới (${data.length} dòng)`);
  };

  const Card = ({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) => (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
      <div className={`inline-flex p-2 rounded-xl ${tone}`}><Icon className="w-5 h-5" /></div>
      <div className="text-2xl font-extrabold text-slate-800 mt-2">{value.toLocaleString('vi-VN')}</div>
      <div className="text-xs font-semibold text-slate-500">{label}</div>
    </div>
  );

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-bold border ${active ? 'bg-vnpt-600 text-white border-vnpt-600' : 'bg-white text-slate-600 border-slate-300'}`;
  const sel = 'px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white';
  const SHOW = 300;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-vnpt-600" /> Theo dõi giấy kiểm định mới
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Trạm đã có giấy mới: giao cho ai, thuộc Tổ nào, đã dán niêm yết chưa, đã có ảnh chưa.
          </p>
        </div>
        <button onClick={exportXlsx} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-vnpt-600 text-white text-sm font-bold">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Trạm có giấy mới" value={total} icon={FileText} tone="bg-sky-100 text-sky-700" />
        <Card label="Đã dán niêm yết" value={posted} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <Card label="Chưa dán" value={total - posted} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
        <Card label="Đã có ảnh niêm yết" value={withPhoto} icon={ImageOff} tone="bg-amber-100 text-amber-700" />
      </div>

      {postedNoPhoto > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
          Có <b>{postedNoPhoto}</b> trạm ghi "Đã dán" nhưng <b>chưa có ảnh</b> niêm yết.
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <button className={chip(mode === 'all')} onClick={() => setMode('all')}>Tất cả</button>
        <button className={chip(mode === 'upload')} onClick={() => setMode('upload')}>Tải PDF qua app</button>
        <button className={chip(mode === 'year')} onClick={() => setMode('year')}>Cấp từ {SINCE_YEAR}</button>
        <select className={sel} value={org} onChange={e => setOrg(e.target.value)}>
          <option value="">Tất cả Tổ</option>
          {orgs.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className={sel} value={status} onChange={e => setStatus(e.target.value as any)}>
          <option value="">Mọi trạng thái</option>
          <option value="posted">Đã dán</option>
          <option value="notPosted">Chưa dán</option>
          <option value="noPhoto">Chưa có ảnh</option>
        </select>
        <input className={sel} placeholder="Tìm mã, tên trạm, người..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Tổ</th>
              <th className="text-right p-3">Giấy mới</th>
              <th className="text-right p-3">Đã dán</th>
              <th className="text-right p-3">Chưa dán</th>
              <th className="text-right p-3">Có ảnh</th>
            </tr>
          </thead>
          <tbody>
            {byOrg.map(([o, v]) => (
              <tr key={o} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-slate-700">{o}</td>
                <td className="p-3 text-right">{v.total}</td>
                <td className="p-3 text-right text-emerald-700">{v.posted}</td>
                <td className="p-3 text-right text-red-600">{v.total - v.posted}</td>
                <td className="p-3 text-right">{v.photo}</td>
              </tr>
            ))}
            {byOrg.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Chưa có trạm nào</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left p-3">Mã CSHT</th>
              <th className="text-left p-3">Tên trạm</th>
              <th className="text-left p-3">Tổ</th>
              <th className="text-left p-3">Người được giao</th>
              <th className="text-left p-3">Hạn giấy</th>
              <th className="text-left p-3">Niêm yết</th>
              <th className="text-right p-3">Ảnh</th>
              <th className="text-left p-3">Giấy PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, SHOW).map(r => (
              <tr key={r.s.id_nha_tram} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{r.s.ma_nha_tram}</td>
                <td className="p-3">{r.s.ten_nha_tram}</td>
                <td className="p-3">{r.s.to_ha_tang}</td>
                <td className="p-3">{r.s.nguoi_phu_trach || <span className="text-slate-400">Chưa giao</span>}</td>
                <td className="p-3">{r.expiry ? formatVnDate(r.expiry) : ''}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.posted ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {r.posted ? 'Đã dán' : 'Chưa dán'}
                  </span>
                </td>
                <td className={`p-3 text-right font-semibold ${r.photos ? 'text-emerald-700' : 'text-slate-400'}`}>{r.photos || 'Chưa có'}</td>
                <td className="p-3">
                  {r.pdf ? <a href={r.pdf} target="_blank" rel="noreferrer" className="text-vnpt-600 underline">Xem</a> : <span className="text-slate-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > SHOW && (
          <div className="p-3 text-xs text-slate-500 border-t">Hiển thị {SHOW}/{filtered.length} dòng đầu, dùng bộ lọc hoặc xuất Excel để xem đủ.</div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        "Giấy mới" gồm trạm có file PDF tải qua tab "Tải giấy kiểm định mới" hoặc có ngày cấp giấy từ {SINCE_YEAR}.
        Trạng thái dán và ảnh lấy từ tab Công bố kiểm định BTS.
      </p>
    </div>
  );
};
