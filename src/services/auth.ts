import { getAppScriptUrl } from './api';

export type Role = 'admin' | 'totruong' | 'nhanvien';

export interface AuthUser {
  username: string;
  maNV: string;
  ten: string;
  to: string;
  chucDanh: string;
  email: string;
  role: Role;
}

export interface Session {
  token: string;
  user: AuthUser;
  weak: boolean;
  mustChoose: boolean;
}

const KEY = 'nhatram5s_session';
export const AUTH_EXPIRED_EVENT = 'nhatram5s-auth-expired';

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Quản trị dữ liệu',
  totruong: 'Tổ trưởng',
  nhanvien: 'Nhân viên quản lý trạm'
};

export const getSession = (): Session | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

export const saveSession = (s: Session | null) => {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* bỏ qua */
  }
};

export const getToken = (): string => getSession()?.token || '';

/** Dùng thay JSON.stringify cho body các request gửi Apps Script: tự đính kèm mã phiên. */
export const authBody = (payload: Record<string, unknown>): string =>
  JSON.stringify({ ...payload, token: getToken() });

/** Gọi API có xác thực; tự báo hết phiên khi backend trả code AUTH. */
export const apiPost = async (action: string, data?: unknown): Promise<any> => {
  const res = await fetch(getAppScriptUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: authBody({ action, data }),
    redirect: 'follow'
  });
  const json = await res.json();
  if (json?.code === 'AUTH') notifyExpired();
  return json;
};

export const notifyExpired = () => {
  saveSession(null);
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};

export const login = async (username: string, password: string): Promise<Session> => {
  const res = await fetch(getAppScriptUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'login', data: { username, password } }),
    redirect: 'follow'
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Đăng nhập thất bại');
  const s: Session = json.data;
  saveSession(s);
  return s;
};

export const logout = async () => {
  try {
    await apiPost('logout');
  } catch {
    /* bỏ qua */
  }
  saveSession(null);
};

export const keepPassword = async () => {
  const json = await apiPost('keepPassword');
  if (json.status !== 'success') throw new Error(json.message);
  const s = getSession();
  if (s) saveSession({ ...s, mustChoose: false });
};

export const changePassword = async (oldPassword: string, newPassword: string) => {
  const json = await apiPost('changePassword', { oldPassword, newPassword });
  if (json.status !== 'success') throw new Error(json.message || 'Đổi mật khẩu thất bại');
  const s = getSession();
  if (s) saveSession({ ...s, weak: false, mustChoose: false });
};

export const resetPassword = async (username: string) => {
  const json = await apiPost('resetPassword', { username });
  if (json.status !== 'success') throw new Error(json.message || 'Không đặt lại được');
  return json.message as string;
};

/** Ghi 1 sự kiện (vd: xuất báo cáo) vào Nhật ký thao tác; không làm gián đoạn người dùng nếu lỗi. */
export const logEvent = (loai: string, chi_tiet = '', ma_tram = '') => {
  apiPost('logEvent', { loai, chi_tiet, ma_tram }).catch(() => undefined);
};
