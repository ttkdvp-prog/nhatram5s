import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSearch, Loader2, Info, ScanLine } from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { apiPost, getSession } from '../services/auth';
import { getEffectiveExpiry } from '../utils/btsDates';

interface Props {
  stations: Station[];
  btsInspections: BtsInspection[];
  onOpenRecord: () => void;
}

interface HashRow {
  file_id: string;
  md5: string;
  trang_thai: string;
}

type Kind = 'thieu_file' | 'trung' | 'thieu_han' | 'loi_tep';

const KIND_LABEL: Record<Kind, string> = {
  thieu_file: 'Đã dán nhưng thiếu ảnh/PDF',
  trung: 'Ảnh/PDF trùng giữa các trạm',
  thieu_han: 'Có số giấy nhưng thiếu ngày hết hạn',
  loi_tep: 'Tệp không đọc được'
};

const fileIdOf = (url: string): string | null => {
  const m = String(url).match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  return m ? m[1] : null;
};

interface Issue {
  kind: Kind;
  station: Station;
  detail: string;
}

export const EvidenceCheckView: React.FC<Props> = ({ stations, btsInspections, onOpenRecord }) => {
  const [hashes, setHashes] = useState<HashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanMsg, setScanMsg] = useState('');
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<Kind | ''>('');
  const isAdmin = getSession()?.user.role === 'admin';

  const loadHashes = useCallback(async () => {
    try {
      const json = await apiPost('getEvidenceHashes');
      if (json.status === 'success') setHashes(json.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHashes();
  }, [loadHashes]);

  // Quét từng lô (40 tệp) cho tới khi hết; mỗi lô là 1 lần gọi riêng để không vượt giới hạn thời gian Apps Script
  const runScan = async () => {
    setScanning(true);
    let total = 0;
    try {
      for (let guard = 0; guard < 200; guard++) {
        const json = await apiPost('scanEvidenceHashes');
        if (json.status !== 'success') {
          setScanMsg(json.message || 'Quét thất bại');
          break;
        }
        total += json.data.processed;
        setScanMsg(`Đã quét ${total} tệp, còn ${json.data.remaining} tệp...`);
        if (json.data.remaining === 0 || json.data.processed === 0) {
          setScanMsg(`Hoàn tất: đã quét ${total} tệp mới.`);
          break;
        }
      }
    } catch {
      setScanMsg('Mất kết nối khi quét; bấm quét lại để tiếp tục từ chỗ dừng.');
    } finally {
      setScanning(false);
      loadHashes();
    }
  };

  const inspByStation = useMemo(() => {
    const m = new Map<string, BtsInspection>();
    btsInspections.forEach(b => m.set(b.id_nha_tram, b));
    return m;
  }, [btsInspections]);

  const issues = useMemo(() => {
    const out: Issue[] = [];
    const hashMap = new Map<string, HashRow>();
    hashes.forEach(h => hashMap.set(h.file_id, h));
    const md5Stations = new Map<string, Set<string>>();

    stations.forEach(s => {
      const insp = inspByStation.get(s.id_nha_tram);
      const files = insp?.anh_niem_yet_list || [];

      if (insp?.trang_thai === 'Đã dán' && files.length === 0) {
        out.push({ kind: 'thieu_file', station: s, detail: 'Trạng thái Đã dán nhưng chưa có tệp minh chứng' });
      }

      if ((s.GCN_kiem_dinh || s.GCN_cong_bo) && !getEffectiveExpiry(s)) {
        out.push({ kind: 'thieu_han', station: s, detail: `Số giấy: ${s.GCN_kiem_dinh || s.GCN_cong_bo}` });
      }

      files.forEach(u => {
        const id = fileIdOf(u);
        const h = id ? hashMap.get(id) : undefined;
        if (!h) return;
        if (h.trang_thai === 'LOI') {
          out.push({ kind: 'loi_tep', station: s, detail: `Không mở được tệp ${id}` });
        } else if (h.md5) {
          if (!md5Stations.has(h.md5)) md5Stations.set(h.md5, new Set());
          md5Stations.get(h.md5)!.add(s.id_nha_tram);
        }
      });
    });

    const stById = new Map(stations.map(s => [s.id_nha_tram, s]));
    md5Stations.forEach(set => {
      if (set.size < 2) return;
      const ids = Array.from(set);
      ids.forEach(id => {
        const s = stById.get(id)!;
        const others = ids.filter(x => x !== id).map(x => stById.get(x)?.ma_nha_tram).join(', ');
        out.push({ kind: 'trung', station: s, detail: `Trùng tệp với trạm: ${others}` });
      });
    });
    return out;
  }, [stations, inspByStation, hashes]);

  const counts = useMemo(() => {
    const c: Record<Kind, number> = { thieu_file: 0, trung: 0, thieu_han: 0, loi_tep: 0 };
    issues.forEach(i => c[i.kind]++);
    return c;
  }, [issues]);

  const list = filter ? issues.filter(i => i.kind === filter) : issues;
  const scanned = hashes.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <FileSearch className="w-6 h-6 text-vnpt-600" /> Đối soát minh chứng
        </h2>
        <p className="text-sm text-slate-500 mt-1">Tự phát hiện hồ sơ thiếu, sai hoặc nghi trùng minh chứng.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.keys(KIND_LABEL) as Kind[]).map(k => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? '' : k)}
            className={`text-left bg-white rounded-2xl p-4 border shadow-xs ${filter === k ? 'border-vnpt-600 ring-2 ring-vnpt-200' : 'border-slate-200'}`}
          >
            <div className="text-2xl font-extrabold text-slate-800">{counts[k]}</div>
            <div className="text-xs font-semibold text-slate-500">{KIND_LABEL[k]}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="text-sm text-slate-600 mr-auto">
          Đã băm nội dung <b>{scanned}</b> tệp. Kiểm tra trùng và tệp lỗi chỉ chính xác sau khi quét hết các tệp.
          {scanMsg && <div className="text-xs text-slate-500 mt-1">{scanMsg}</div>}
        </div>
        {isAdmin ? (
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-vnpt-600 text-white text-sm font-bold disabled:opacity-60"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />} Quét tệp minh chứng
          </button>
        ) : (
          <span className="text-xs text-slate-400">Chỉ quản trị mới chạy được quét tệp</span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 overflow-x-auto">
        <h3 className="font-bold text-slate-700 text-sm mb-2">Danh sách cần xử lý ({list.length})</h3>
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-2">Loại lỗi</th>
                <th className="text-left p-2">Mã trạm</th>
                <th className="text-left p-2">Tổ / nhân viên</th>
                <th className="text-left p-2">Chi tiết</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 300).map((i, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  <td className="p-2 whitespace-nowrap">{KIND_LABEL[i.kind]}</td>
                  <td className="p-2 font-mono text-xs">{i.station.ma_nha_tram}<div className="font-sans text-slate-400">{i.station.ten_nha_tram}</div></td>
                  <td className="p-2">{i.station.to_ha_tang}<div className="text-xs text-slate-400">{i.station.nguoi_phu_trach}</div></td>
                  <td className="p-2 text-xs text-slate-500">{i.detail}</td>
                  <td className="p-2">
                    <button onClick={onOpenRecord} className="text-xs font-bold text-vnpt-700 underline whitespace-nowrap">Xem bản ghi</button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">Không phát hiện vấn đề nào</td></tr>}
            </tbody>
          </table>
        )}
        {list.length > 300 && <p className="text-xs text-slate-400 p-2">Hiển thị 300 dòng đầu.</p>}
      </div>

      <div className="flex items-start space-x-2 p-3 rounded-xl bg-sky-50 text-sky-800 text-xs">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <b>Chưa kiểm tra:</b> "ảnh ngoài vị trí trạm" đã bỏ qua vì dữ liệu trạm chưa có tọa độ và hệ thống chưa đọc tọa độ
          trong ảnh. Khi bổ sung tọa độ trạm, mục này sẽ được thêm.
        </div>
      </div>
    </div>
  );
};
