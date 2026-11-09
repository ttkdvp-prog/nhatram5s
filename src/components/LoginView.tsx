import React, { useState } from 'react';
import { Radio, LogIn, Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { login, keepPassword, changePassword, Session } from '../services/auth';

interface Props {
  onLoggedIn: (s: Session) => void;
}

/** Màn hình đăng nhập + bước chọn giữ/đổi mật khẩu ở lần đăng nhập đầu. */
export const LoginView: React.FC<Props> = ({ onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Session | null>(null);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s = await login(username.trim(), password);
      if (s.mustChoose) setPending(s);
      else onLoggedIn(s);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setBusy(false);
    }
  };

  const keep = async () => {
    setBusy(true);
    setError('');
    try {
      await keepPassword();
      onLoggedIn({ ...pending!, mustChoose: false });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== newPw2) return setError('Hai mật khẩu mới không khớp');
    setBusy(true);
    setError('');
    try {
      await changePassword(password, newPw);
      onLoggedIn({ ...pending!, weak: false, mustChoose: false });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-vnpt-500';

  return (
    <div className="min-h-screen flex items-center justify-center vnpt-gradient-sidebar p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-7">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 bg-vnpt-600 rounded-xl">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-xl text-vnpt-700 leading-tight">NHÀ TRẠM</h1>
            <p className="text-xs text-slate-500">Trung tâm Hạ tầng - VNPT Phú Thọ</p>
          </div>
        </div>

        {!pending ? (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="font-bold text-slate-800">Đăng nhập</h2>
            <input
              className={input}
              placeholder="Tên đăng nhập (vd: cuongnv.vpc)"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
            <div className="relative">
              <input
                className={input}
                type={show ? 'text' : 'password'}
                placeholder="Mật khẩu"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-3 text-slate-400"
                aria-label="Hiện/ẩn mật khẩu"
              >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              disabled={busy}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-vnpt-600 text-white font-bold disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              <span>Đăng nhập</span>
            </button>
          </form>
        ) : (
          <form onSubmit={change} className="space-y-4">
            <div className="flex items-start space-x-2 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                Xin chào <b>{pending.user.ten}</b>. Bạn đang dùng mật khẩu mặc định. Nên đổi mật khẩu để bảo mật; bạn
                cũng có thể giữ nguyên.
              </span>
            </div>
            <input
              className={input}
              type="password"
              placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
            <input
              className={input}
              type="password"
              placeholder="Nhập lại mật khẩu mới"
              value={newPw2}
              onChange={e => setNewPw2(e.target.value)}
              autoComplete="new-password"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy || !newPw} className="w-full py-3 rounded-xl bg-vnpt-600 text-white font-bold disabled:opacity-60">
              Đổi mật khẩu
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={keep}
              className="w-full py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold"
            >
              Giữ nguyên mật khẩu hiện tại
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
