import React, { useRef, useState } from 'react';
import { FileUp, Loader2, CheckCircle2, AlertTriangle, Search } from 'lucide-react';
import { apiPost } from '../services/auth';
import { readCertificatePdf } from '../utils/certificatePdf';

interface Props {
  onSaved: () => void;
}

interface StationInfo {
  ma_nha_tram: string;
  ten_nha_tram: string;
  to_ha_tang: string;
  nguoi_phu_trach: string;
  GCN_kiem_dinh: string;
  GCN_cong_bo: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const CSHT_RE = /^CSHT_[A-Z0-9]{2,6}_\d{4,6}$/;

const strip = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

const validDmy = (s: string) => {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return false;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1;
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được file'));
    r.readAsDataURL(file);
  });

export const CertificateUploadView: React.FC<Props> = ({ onSaved }) => {
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [ma, setMa] = useState('');
  const [station, setStation] = useState<StationInfo | null>(null);
  const [maError, setMaError] = useState('');
  const [reading, setReading] = useState('');
  const [readNote, setReadNote] = useState('');
  const [loai, setLoai] = useState<'kiem_dinh' | 'cong_bo'>('kiem_dinh');
  const [soGiay, setSoGiay] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = async (f: File | undefined) => {
    setDone('');
    setError('');
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return setError('Chỉ nhận file PDF');
    if (f.size > MAX_BYTES) return setError('File vượt quá 10MB');
    setFile(f);
    setReading('Đang đọc PDF...');
    setReadNote('');
    try {
      const g = await readCertificatePdf(f, setReading);
      setLoai(g.loai);
      setSoGiay(g.so_giay);
      setStart(g.ngay_bat_dau);
      setEnd(g.ngay_het_han);
      setReadNote(
        g.method === 'none'
          ? 'Không đọc được nội dung PDF, vui lòng nhập tay các trường bên dưới.'
          : `Đã đọc bằng ${g.method === 'ocr' ? 'nhận dạng chữ (OCR)' : 'văn bản trong PDF'}. Hãy kiểm tra và sửa nếu sai.`
      );
    } catch {
      setReadNote('Không đọc được nội dung PDF, vui lòng nhập tay các trường bên dưới.');
    } finally {
      setReading('');
    }
  };

  const lookup = async () => {
    const code = ma.trim().toUpperCase();
    setMa(code);
    setStation(null);
    setMaError('');
    if (!CSHT_RE.test(code)) return setMaError('Mã CSHT sai định dạng (ví dụ: CSHT_HBH_00037)');
    const j = await apiPost('lookupStation', { ma_nha_tram: code });
    if (j.status === 'success') setStation(j.data);
    else setMaError(j.message || 'Không tra được mã');
  };

  const fileName =
    station && validDmy(start)
      ? (() => {
          const [, mo, y] = start.trim().split('/');
          return `${y}-${mo.padStart(2, '0')}_${strip(station.to_ha_tang)}_${strip(station.nguoi_phu_trach)}_${station.ma_nha_tram}.pdf`;
        })()
      : '';

  const canSave = !!file && !!station && soGiay.trim() && validDmy(start) && validDmy(end) && !saving;

  const save = async (overwrite = false) => {
    if (!file || !station) return;
    setSaving(true);
    setError('');
    try {
      const base64Data = await toBase64(file);
      const j = await apiPost('uploadCertificate', {
        ma_nha_tram: station.ma_nha_tram,
        loai,
        so_giay: soGiay.trim(),
        ngay_bat_dau: start.trim(),
        ngay_het_han: end.trim(),
        base64Data,
        overwrite
      });
      if (j.status === 'exists') {
        const names = (j.data as { name: string }[]).map(x => x.name).join('\n');
        if (window.confirm(`Đã có file của mã này trên Drive:\n${names}\n\nGhi đè bằng file mới? (Bản cũ chuyển vào thùng rác Drive, khôi phục được.)\nChọn Hủy để giữ bản cũ.`)) {
          setSaving(false);
          return save(true);
        }
        setError('Đã giữ nguyên bản cũ, chưa lưu file mới.');
      } else if (j.status === 'success') {
        setDone(`${j.message}. Tên file: ${j.data.fileName}`);
        setFile(null);
        setMa('');
        setStation(null);
        setSoGiay('');
        setStart('');
        setEnd('');
        onSaved();
      } else {
        setError(j.message || 'Lưu thất bại');
      }
    } catch (e: any) {
      setError(e.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white';

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <FileUp className="w-6 h-6 text-vnpt-600" /> Tải giấy kiểm định mới
        </h2>
        <p className="text-sm text-slate-500 mt-1">Tải PDF giấy kiểm định / bản công bố, hệ thống đọc số giấy và hạn rồi cập nhật cho trạm.</p>
      </div>

      {done && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" /> {done}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">Bước 1 - Chọn file PDF</h3>
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer text-center p-6 rounded-xl border-2 border-dashed text-sm ${drag ? 'border-vnpt-600 bg-sky-50' : 'border-slate-300'}`}
        >
          {file ? <b>{file.name}</b> : 'Kéo thả file PDF vào đây hoặc bấm để chọn'}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => pickFile(e.target.files?.[0])} />
        </div>
        {reading && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> {reading}</div>}
        {readNote && <p className="text-xs text-slate-500">{readNote}</p>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">Bước 2 - Mã cơ sở hạ tầng (CSHT)</h3>
        <div className="flex gap-2">
          <input
            className={input}
            placeholder="CSHT_HBH_00037"
            value={ma}
            onChange={e => { setMa(e.target.value.toUpperCase()); setStation(null); }}
            onKeyDown={e => e.key === 'Enter' && lookup()}
          />
          <button onClick={lookup} className="flex items-center gap-1 px-4 rounded-xl bg-vnpt-600 text-white text-sm font-bold">
            <Search className="w-4 h-4" /> Tra
          </button>
        </div>
        {maError && <p className="text-sm text-red-600 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {maError}</p>}
        {station && (
          <div className="text-sm bg-slate-50 rounded-xl p-3">
            <div className="font-semibold">{station.ten_nha_tram}</div>
            <div className="text-slate-500">{station.to_ha_tang} · {station.nguoi_phu_trach}</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm">Bước 3 - Xác nhận thông tin giấy</h3>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1"><input type="radio" checked={loai === 'kiem_dinh'} onChange={() => setLoai('kiem_dinh')} /> Giấy kiểm định</label>
          <label className="flex items-center gap-1"><input type="radio" checked={loai === 'cong_bo'} onChange={() => setLoai('cong_bo')} /> Bản công bố</label>
        </div>
        <input className={input} placeholder="Số giấy" value={soGiay} onChange={e => setSoGiay(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input className={`${input} ${start && !validDmy(start) ? 'border-red-400' : ''}`} placeholder="Ngày bắt đầu (dd/mm/yyyy)" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <input className={`${input} ${end && !validDmy(end) ? 'border-red-400' : ''}`} placeholder="Ngày hết hạn (dd/mm/yyyy)" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        {fileName && <p className="text-xs text-slate-500">Tên file lưu trên Drive: <span className="font-mono">{fileName}</span></p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={() => save(false)}
          disabled={!canSave}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-vnpt-600 text-white font-bold disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Lưu giấy mới
        </button>
      </div>
    </div>
  );
};
