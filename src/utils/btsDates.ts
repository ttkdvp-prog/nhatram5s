import { Station } from '../types';

// Backend trả ngày dạng dd/MM/yyyy
export const parseVnDate = (s?: string): Date | null => {
  if (!s) return null;
  const [day, month, year] = String(s).trim().split(/[\/\-]/).map(Number);
  if (!day || !month || !year) return null;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Ngày hết hạn hiệu lực của trạm = ngày hết hạn XA HƠN giữa giấy kiểm định và bản công bố.
 * Trả về null nếu trạm không có ngày hết hạn nào.
 */
export const getEffectiveExpiry = (s: Station): Date | null => {
  const a = s.GCN_kiem_dinh ? parseVnDate(s.ngay_het_han_kiem_dinh) : null;
  const b = s.GCN_cong_bo ? parseVnDate(s.ngay_het_han_cong_bo) : null;
  if (a && b) return a.getTime() >= b.getTime() ? a : b;
  return a || b;
};

export const formatVnDate = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
