import React, { useState } from 'react';
import { X } from 'lucide-react';
import { changePassword } from '../services/auth';

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export const ChangePasswordModal: React.FC<Props> = ({ onClose, onChanged }) => {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== newPw2) return setError('Hai mật khẩu mới không khớp');
    setBusy(true);
    setError('');
    try {
      await changePassword(oldPw, newPw);
      onChanged();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-vnpt-500';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl p-6 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Đổi mật khẩu</h3>
          <button type="button" onClick={onClose} aria-label="Đóng"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <input className={input} type="password" placeholder="Mật khẩu hiện tại" value={oldPw} onChange={e => setOldPw(e.target.value)} autoComplete="current-password" required />
        <input className={input} type="password" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" required />
        <input className={input} type="password" placeholder="Nhập lại mật khẩu mới" value={newPw2} onChange={e => setNewPw2(e.target.value)} autoComplete="new-password" required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full py-2.5 rounded-xl bg-vnpt-600 text-white font-bold disabled:opacity-60">Lưu mật khẩu mới</button>
      </form>
    </div>
  );
};
