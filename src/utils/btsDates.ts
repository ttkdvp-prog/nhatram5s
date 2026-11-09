import { Station } from '../types';

// Backend trả ngày dạng dd/MM/yyyy
export const parseVnDate = (s?: string): Date | null => {
  if (!s) return null;
  const p = String(s).trim().split(/[\/\-]/).map(Number);
  let [day, month] = p;
  const year = p[2];
  if (!day || !month || !year) return null;
  // Nếu ô là chuỗi dạng M/d/yyyy (vd 9/19/2025) thì số thứ hai > 12 là ngày: đảo lại
  if (month > 12 && day <= 12) [day, month] = [month, day];
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
