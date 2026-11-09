import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BellRing, Copy, Loader2, Send, Eye, FlaskConical } from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { apiPost, getSession } from '../services/auth';

interface Props {
  stations: Station[];
  btsInspections: BtsInspection[];
}

interface Rule {
  id: string;
  ten: string;
  nguoi_nhan: string;
  bat: boolean;
  ngay_bat_dau: string;
}

interface PreviewMsg {
  username: string;
  ten: string;
  email: string;
  so_tram: number;
  subject: string;
  body: string;
}

interface HistoryRow {
  thoi_diem: string;
  quy_tac: string;
  nguoi_nhan: string;
  ten_nguoi_nhan: string;
  email: string;
  so_tram: number;
  kenh: string;
  tieu_de: string;
  noi_dung: string;
  ma_tram_list: string;
  trang_thai: string;
}

export const RemindersView: React.FC<Props> = ({ stations, btsInspections }) => {
  const isAdmin = getSession()?.user.role === 'admin';
  const [rules, setRules] = useState<Rule[]>([]);
  const [triggerOn, setTriggerOn] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [mine, setMine] = useState<HistoryRow[]>([]);
  const [preview, setPreview] = useState<{ ruleId: string; msgs: PreviewMsg[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const jobs: Promise<void>[] = [
      apiPost('getReminderHistory', { mine: true }).then(j => { if (j.status === "success") setMine(j.data || []); })
    ];
    if (isAdmin) {
      jobs.push(
        apiPost('getReminderRules').then(j => {
          if (j.status === 'success') {
            setRules(j.data.rules);
            setTriggerOn(j.data.triggerOn);
          }
        }),
        apiPost('getReminderHistory').then(j => { if (j.status === "success") setHistory(j.data || []); })
      );
    }
    await Promise.all(jobs).catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setNote('');
    try {
      await fn();
    } catch (e: any) {
      setNote(e.message || 'Có lỗi xảy ra');
    } finally {
      setBusy('');
    }
  };

  const toggleRule = (r: Rule) =>
    run('rule' + r.id, async () => {
      const j = await apiPost('setReminderRule', { id: r.id, bat: !r.bat });
      if (j.status !== 'success') throw new Error(j.message);
      setRules(j.data);
    });

  const toggleTrigger = () =>
    run('trigger', async () => {
      const j = await apiPost('setReminderTrigger', { on: !triggerOn });
      if (j.status !== 'success') throw new Error(j.message);
      setTriggerOn(j.data.on);
    });

  const doPreview = (r: Rule) =>
    run('pv' + r.id, async () => {
      const j = await apiPost('previewReminders', { id: r.id });
      if (j.status !== 'success') throw new Error(j.message);
      setPreview({ ruleId: r.id, msgs: j.data });
    });

  const doSend = (r: Rule, test: boolean) =>
    run((test ? 'test' : 'send') + r.id, async () => {
      if (!test && !window.confirm(`Gửi email thật cho tất cả người nhận của quy tắc "${r.ten}"? Không thể thu hồi.`)) return;
      const j = await apiPost('sendReminders', { id: r.id, test });
      if (j.status !== 'success') throw new Error(j.message);
      setNote(j.data.message);
      load();
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNote('Đã sao chép tin nhắn, dán vào Zalo để gửi.');
    } catch {
      setNote('Trình duyệt không cho sao chép tự động; hãy bôi đen và sao chép thủ công.');
    }
  };

  // Số trạm đã xử lý (đã dán) tính tại thời điểm xem, trong số trạm được nhắc
  const doneByCode = useMemo(() => {
    const idByCode = new Map(stations.map(s => [s.ma_nha_tram, s.id_nha_tram]));
    const insp = new Map(btsInspections.map(b => [b.id_nha_tram, b.trang_thai]));
    return (codes: string) =>
      codes
        .split(',')
        .map(c => c.trim())
        .filter(Boolean)
        .filter(c => insp.get(idByCode.get(c) || '') === 'Đã dán').length;
  }, [stations, btsInspections]);

  const sentHistory = history.filter(h => h.kenh !== 'Gửi thử');
  const btn = 'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-50';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
          <BellRing className="w-6 h-6 text-vnpt-600" /> Nhắc việc tự động
        </h2>
        <p className="text-sm text-slate-500 mt-1">Nhắc trong app và qua email. Zalo: sao chép tin nhắn để gửi tay.</p>
      </div>

      {note && <div className="p-3 rounded-xl bg-sky-50 text-sky-800 text-sm">{note}</div>}

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">Quy tắc nhắc</h3>
            <button
              onClick={toggleTrigger}
              disabled={busy === 'trigger'}
              className={`${btn} ${triggerOn ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'}`}
            >
              Gửi tự động hằng ngày lúc 7h: {triggerOn ? 'ĐANG BẬT' : 'đang tắt'}
            </button>
          </div>
          {rules.map(r => (
            <div key={r.id} className="border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
              <div className="mr-auto min-w-[200px]">
                <div className="font-semibold text-slate-800 text-sm">{r.ten}</div>
                <div className="text-xs text-slate-500">
                  Gửi tới: {r.nguoi_nhan}
                  {r.id === 'CHUA_DAN_14' && (r.ngay_bat_dau ? ` · tính từ ngày giao ${r.ngay_bat_dau}` : ' · tính 14 ngày từ lúc bật quy tắc')}
                </div>
              </div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                <input type="checkbox" checked={r.bat} onChange={() => toggleRule(r)} disabled={busy === 'rule' + r.id} /> Bật
              </label>
              <button className={`${btn} border-slate-300 text-slate-700`} onClick={() => doPreview(r)} disabled={!!busy}>
                {busy === 'pv' + r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Xem trước
              </button>
              <button className={`${btn} border-slate-300 text-slate-700`} onClick={() => doSend(r, true)} disabled={!!busy}>
                <FlaskConical className="w-3.5 h-3.5" /> Gửi thử
              </button>
              <button className={`${btn} bg-vnpt-600 text-white border-vnpt-600`} onClick={() => doSend(r, false)} disabled={!!busy}>
                <Send className="w-3.5 h-3.5" /> Gửi ngay
              </button>
            </div>
          ))}
          <p className="text-[11px] text-slate-400">
            "Gửi thử" chỉ gửi 1 tin mẫu tới email của chính bạn. "Gửi ngay" gửi thật cho từng người nhận.
          </p>
        </div>
      )}

      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-700 text-sm">Xem trước nội dung ({preview.msgs.length} người nhận)</h3>
            <button className="text-xs text-slate-500 underline" onClick={() => setPreview(null)}>Đóng</button>
          </div>
          {preview.msgs.length === 0 && <p className="text-sm text-slate-400">Hiện không có ai cần nhắc theo quy tắc này.</p>}
          {preview.msgs.slice(0, 20).map(m => (
            <div key={m.username} className="border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{m.ten} <span className="text-xs text-slate-400">{m.email || 'chưa có email'}</span></div>
                <button className={`${btn} border-slate-300 text-slate-700`} onClick={() => copy(`${m.subject}\n\n${m.body}`)}>
                  <Copy className="w-3.5 h-3.5" /> Sao chép tin nhắn
                </button>
              </div>
              <div className="text-xs font-bold text-slate-600 mt-1">{m.subject}</div>
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans mt-1">{m.body}</pre>
            </div>
          ))}
          {preview.msgs.length > 20 && <p className="text-xs text-slate-400">Hiển thị 20 người nhận đầu tiên.</p>}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="font-bold text-slate-700 text-sm mb-2">Thông báo của tôi ({mine.length})</h3>
        {mine.length === 0 && <p className="text-sm text-slate-400">Chưa có thông báo nào.</p>}
        {mine.slice(0, 10).map((h, i) => (
          <div key={i} className="border-t border-slate-100 py-2">
            <div className="text-xs text-slate-400">{h.thoi_diem}</div>
            <div className="text-sm font-semibold">{h.tieu_de}</div>
            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans">{h.noi_dung}</pre>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 overflow-x-auto">
          <h3 className="font-bold text-slate-700 text-sm mb-2">Lịch sử đã gửi ({sentHistory.length})</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left p-2">Thời điểm</th>
                <th className="text-left p-2">Quy tắc</th>
                <th className="text-left p-2">Người nhận</th>
                <th className="text-left p-2">Kênh</th>
                <th className="text-right p-2">Số trạm</th>
                <th className="text-right p-2">Đã xử lý sau nhắc</th>
                <th className="text-left p-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sentHistory.slice(0, 100).map((h, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="p-2 whitespace-nowrap">{h.thoi_diem}</td>
                  <td className="p-2 text-xs">{h.quy_tac}</td>
                  <td className="p-2">{h.ten_nguoi_nhan}</td>
                  <td className="p-2 text-xs">{h.kenh}</td>
                  <td className="p-2 text-right">{h.so_tram}</td>
                  <td className="p-2 text-right">{doneByCode(h.ma_tram_list)}/{h.so_tram}</td>
                  <td className="p-2 text-xs text-slate-500">{h.trang_thai}</td>
                </tr>
              ))}
              {sentHistory.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">Chưa gửi nhắc nào</td></tr>}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-2">
            "Đã xử lý sau nhắc" = số trạm trong tin nhắn hiện đang ở trạng thái Đã dán (tính tại thời điểm xem).
          </p>
        </div>
      )}
    </div>
  );
};
