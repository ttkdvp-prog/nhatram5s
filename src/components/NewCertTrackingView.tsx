import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ClipboardList, Download, CheckCircle2, AlertTriangle, FileText, ImagePlus, Loader2 } from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { apiPost, logEvent } from '../services/auth';
import { saveBtsInspectionPhotos, BtsUploadFile } from '../services/api';
import { compressImageFile, readFileAsDataUrl } from '../utils/imageHelper';
import { parseVnDate, formatVnDate } from '../utils/btsDates';

interface Props {
  stations: Station[];
  btsInspections: BtsInspection[];
  isAdmin: boolean;
  onUpdated: (updated: BtsInspection) => void;
  onReload: () => void;
}

interface Row {
  s: Station;
  pdf: string;
  issued: Date | null;
  hasBaseline: boolean;
  newPhotos: string[];
  posted: boolean;
  tai: string;
}

// Ngày cấp / ký văn bản: lấy ngày muộn hơn giữa giấy kiểm định và bản công bố
const issuedOf = (s: Station): Date | null => {
  const a = s.GCN_kiem_dinh ? parseVnDate(s.ngay_cap_kiem_dinh) : null;
  const b = s.GCN_cong_bo ? parseVnDate(s.ngay_cap_cong_bo) : null;
  if (a && b) return a.getTime() >= b.getTime() ? a : b;
  return a || b;
};

const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url) || url.includes('drive.google.com/file') || url.startsWith('data:application/pdf');

export const NewCertTrackingView: React.FC<Props> = ({ stations, btsInspections, isAdmin, onUpdated, onReload }) => {
  const [org, setOrg] = useState('');
  const [status, setStatus] = useState<'' | 'posted' | 'notPosted'>('');
  const [q, setQ] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Station | null>(null);

  const inspMap = useMemo(() => {
    const m = new Map<string, BtsInspection>();
    btsInspections.forEach(b => m.set(b.id_nha_tram, b));
    return m;
  }, [btsInspections]);

  // Chỉ các trạm đã được tải giấy PDF lên app bằng thao tác thủ công
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    stations.forEach(s => {
      const a = s as any;
      const pdf = String(a.link_giay_pdf || '').trim();
      if (!pdf) return;
      // Chỉ trạm do người dùng tải thủ công; file do quét thư mục Drive (nguon_giay = 'quet') không hiện ở đây
      if (String(a.nguon_giay || '') === 'quet') return;
      const baseRaw = a.so_anh_truoc;
      const hasBaseline = baseRaw !== undefined && baseRaw !== null && String(baseRaw).trim() !== '';
      const photos = inspMap.get(s.id_nha_tram)?.anh_niem_yet_list || [];
      // Ảnh dán cho giấy mới = ảnh thêm sau mốc lúc tải giấy; ảnh/trạng thái cũ không tính
      const newPhotos = hasBaseline ? photos.slice(Number(baseRaw) || 0) : [];
      out.push({
        s,
        pdf,
        issued: issuedOf(s),
        hasBaseline,
        newPhotos,
        posted: newPhotos.length > 0,
        tai: String(a.ngay_tai_giay || '')
      });
    });
    return out;
  }, [stations, inspMap]);

  const missingBaseline = rows.filter(r => !r.hasBaseline).length;

  const orgs = useMemo(
    () => Array.from(new Set(rows.map(r => r.s.to_ha_tang || 'Chưa phân tổ'))).sort((a, b) => a.localeCompare(b, 'vi')),
    [rows]
  );

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter(r => {
      if (org && (r.s.to_ha_tang || 'Chưa phân tổ') !== org) return false;
      if (status === 'posted' && !r.posted) return false;
      if (status === 'notPosted' && r.posted) return false;
      if (kw && !`${r.s.ma_nha_tram} ${r.s.ten_nha_tram} ${r.s.nguoi_phu_trach}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [rows, org, status, q]);

  const total = filtered.length;
  const posted = filtered.filter(r => r.posted).length;

  const byOrg = useMemo(() => {
    const m = new Map<string, { total: number; posted: number }>();
    filtered.forEach(r => {
      const k = r.s.to_ha_tang || 'Chưa phân tổ';
      const o = m.get(k) || { total: 0, posted: 0 };
      o.total++;
      if (r.posted) o.posted++;
      m.set(k, o);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [filtered]);

  const openPicker = (s: Station) => {
    pendingRef.current = s;
    fileRef.current?.click();
  };

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const station = pendingRef.current;
    const files = e.target.files;
    if (!station || !files || files.length === 0) return;
    pendingRef.current = null;
    const list = Array.from(files);
    e.target.value = '';
    setUploadingId(station.id_nha_tram);
    setMsg('');
    try {
      const sanitize = (x: string) => x.replace(/[\\/:*?"<>|]/g, '').trim();
      const prefix = `${sanitize(station.to_ha_tang || '')}_${sanitize(station.nguoi_phu_trach || '')}`.replace(/\s+/g, '');
      const photoFiles: BtsUploadFile[] = await Promise.all(
        list.map(async (file, i) => {
          const isPdf = file.type === 'application/pdf';
          const dataUrl = isPdf ? await readFileAsDataUrl(file) : await compressImageFile(file, 1280, 1280, 0.72);
          return {
            dataUrl,
            mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
            fileName: isPdf
              ? `${prefix}_${sanitize(file.name || `${station.ma_nha_tram}_${Date.now()}_${i + 1}.pdf`)}`
              : `${prefix}_${station.ma_nha_tram}_${Date.now()}_${i + 1}.jpg`,
            isPdf
          };
        })
      );
      const updated = await saveBtsInspectionPhotos({
        id_nha_tram: station.id_nha_tram,
        ma_nha_tram: station.ma_nha_tram,
        ten_nha_tram: station.ten_nha_tram,
        to_ha_tang: station.to_ha_tang,
        nguoi_phu_trach: station.nguoi_phu_trach,
        ma_nv: station.ma_nv,
        nguoi_tai: station.nguoi_phu_trach || 'Không xác định',
        photoFiles
      });
      onUpdated(updated);
      setMsg(`Đã gán ảnh cho ${station.ma_nha_tram}`);
    } catch (err: any) {
      setMsg(`Gán ảnh thất bại: ${err?.message || 'lỗi không xác định'}`);
    } finally {
      setUploadingId(null);
    }
  };

  const backfill = async () => {
    if (!window.confirm(`Chốt mốc ảnh hiện tại cho ${missingBaseline} trạm đã tải giấy. Từ lúc này chỉ ảnh thêm mới mới tính là đã dán giấy mới. Tiếp tục?`)) return;
    setBusy(true);
    try {
      const j = await apiPost('certBackfill', {});
      setMsg(j.message || (j.status === 'success' ? 'Đã chốt mốc' : 'Chốt mốc thất bại'));
      if (j.status === 'success') onReload();
    } finally {
      setBusy(false);
    }
  };

  const exportXlsx = () => {
    const data = filtered.map((r, i) => ({
      STT: i + 1,
      'Mã CSHT': r.s.ma_nha_tram,
      'Tên trạm': r.s.ten_nha_tram,
      'Tổ': r.s.to_ha_tang,
      'Người được giao': r.s.nguoi_phu_trach,
      'Mã NV': r.s.ma_nv || '',
      'Ngày cấp/ký': r.issued ? formatVnDate(r.issued) : '',
      'Dán niêm yết': r.posted ? 'Đã dán' : 'Chưa dán',
      'Số ảnh dán mới': r.newPhotos.length,
      'Link giấy PDF': r.pdf
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

  const sel = 'px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white';
  const SHOW = 300;

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={onFiles} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-vnpt-600" /> Theo dõi giấy kiểm định mới
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Các trạm đã được tải giấy PDF lên app: giao cho ai, thuộc Tổ nào, đã dán niêm yết và đã gán ảnh chưa.
          </p>
        </div>
        <button onClick={exportXlsx} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-vnpt-600 text-white text-sm font-bold">
          <Download className="w-4 h-4" /> Xuất Excel
        </button>
      </div>

      {msg && <div className="p-3 rounded-xl bg-sky-50 text-sky-800 text-sm">{msg}</div>}

      {isAdmin && missingBaseline > 0 && (
        <div>
          <button onClick={backfill} disabled={busy} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold disabled:opacity-50">
            {busy ? 'Đang chốt...' : `Chốt mốc (${missingBaseline})`}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card label="Trạm đã tải giấy mới" value={total} icon={FileText} tone="bg-sky-100 text-sky-700" />
        <Card label="Đã dán (có ảnh mới)" value={posted} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700" />
        <Card label="Chưa dán" value={total - posted} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select className={sel} value={org} onChange={e => setOrg(e.target.value)}>
          <option value="">Tất cả Tổ</option>
          {orgs.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className={sel} value={status} onChange={e => setStatus(e.target.value as any)}>
          <option value="">Mọi trạng thái</option>
          <option value="posted">Đã dán</option>
          <option value="notPosted">Chưa dán</option>
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
            </tr>
          </thead>
          <tbody>
            {byOrg.map(([o, v]) => (
              <tr key={o} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-slate-700">{o}</td>
                <td className="p-3 text-right">{v.total}</td>
                <td className="p-3 text-right text-emerald-700">{v.posted}</td>
                <td className="p-3 text-right text-red-600">{v.total - v.posted}</td>
              </tr>
            ))}
            {byOrg.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">Chưa có trạm nào tải giấy PDF</td></tr>}
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
              <th className="text-left p-3">Ngày cấp/ký</th>
              <th className="text-left p-3">Niêm yết</th>
              <th className="text-left p-3">Ảnh dán</th>
              <th className="text-left p-3">Giấy PDF</th>
              <th className="text-left p-3">Gán ảnh</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, SHOW).map(r => {
              const busyRow = uploadingId === r.s.id_nha_tram;
              return (
                <tr key={r.s.id_nha_tram} className="border-t border-slate-100">
                  <td className="p-3 font-mono text-xs">{r.s.ma_nha_tram}</td>
                  <td className="p-3">{r.s.ten_nha_tram}</td>
                  <td className="p-3">{r.s.to_ha_tang}</td>
                  <td className="p-3">{r.s.nguoi_phu_trach || <span className="text-slate-400">Chưa giao</span>}</td>
                  <td className="p-3">{r.issued ? formatVnDate(r.issued) : ''}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${r.posted ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {r.posted ? 'Đã dán' : 'Chưa dán'}
                    </span>
                  </td>
                  <td className="p-3">
                    {r.newPhotos.length === 0 ? (
                      <span className="text-slate-400">Chưa có</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {r.newPhotos.map((u, i) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer" className="text-vnpt-600 underline text-xs">
                            {isPdfUrl(u) ? 'PDF' : 'Ảnh'} {i + 1}
                          </a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <a href={r.pdf} target="_blank" rel="noreferrer" className="text-vnpt-600 underline">Xem</a>
                  </td>
                  <td className="p-3">
                    {busyRow ? (
                      <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                    ) : (
                      <span className="flex gap-1">
                        <button title="Gắn file ảnh/PDF có sẵn" onClick={() => openPicker(r.s)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-vnpt-600 text-white text-xs font-bold"><ImagePlus className="w-4 h-4" /> Gắn file</button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > SHOW && (
          <div className="p-3 text-xs text-slate-500 border-t">Hiển thị {SHOW}/{filtered.length} dòng đầu, dùng bộ lọc hoặc xuất Excel để xem đủ.</div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Chỉ hiển thị trạm đã được tải giấy PDF qua tab "Tải giấy kiểm định mới". Trạm chỉ tính "Đã dán" khi có ảnh được gán
        <b> sau</b> lúc tải giấy mới; ảnh và trạng thái dán của giấy cũ không được tính.
      </p>
    </div>
  );
};
