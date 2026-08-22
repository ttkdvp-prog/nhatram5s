export interface Station {
  id_nha_tram: string;
  ma_nha_tram: string;
  ten_nha_tram: string;
  to_ha_tang: string;
  dia_ban: string;
  loai_nha_tram: string;
  dia_chi: string;
  co_may_phat: string;
  nguoi_phu_trach: string;
  ma_nv?: string;
  email_phu_trach?: string;
  he_so_quy_doi?: number;
  trang_thai: string;
  ghi_chu?: string;
}

export interface SurveyRecord {
  id_ho_so: string;
  id_nha_tram: string;
  ma_nha_tram: string;
  ten_nha_tram: string;
  to_ha_tang: string;
  ngay_khao_sat: string;
  dot_danh_gia: string;
  nguoi_khao_sat: string;
  email_nguoi_khao_sat: string;
  s1_truoc: number;
  s2_truoc: number;
  s3_truoc: number;
  s4_truoc: number;
  s5_truoc: number;
  tong_truoc: number;
  s1_sau: number;
  s2_sau: number;
  s3_sau: number;
  s4_sau: number;
  s5_sau: number;
  tong_sau: number;
  muc_cai_thien: number;
  xep_loai_truoc: string;
  xep_loai_sau: string;
  nguy_co_nghiem_trong: string;
  duoc_cong_nhan: string;
  noi_dung_thuc_hien: string;
  anh_truoc_url?: string;
  anh_sau_url?: string;
  anh_truoc_list?: string[];
  anh_sau_list?: string[];
  ngay_hoan_thanh?: string;
  ngay_tai_kiem_tra?: string;
  trang_thai_ho_so: string;
  canh_bao_tai_kiem_tra: 'Đúng hạn' | 'Sắp đến hạn' | 'Quá hạn' | string;
  nguoi_cap_nhat?: string;
  thoi_diem_cap_nhat?: string;
  // Attached risk content
  noi_dung_kien_nghi?: string;
  muc_uu_tien?: string;
}

export interface Recommendation {
  id_kien_nghi: string;
  id_ho_so: string;
  id_nha_tram: string;
  ma_nha_tram: string;
  to_ha_tang: string;
  ngay_phat_hien: string;
  loai_nguy_co: string;
  muc_uu_tien: 'Khẩn cấp' | 'Cao' | 'Trung bình' | 'Thấp' | string;
  noi_dung_kien_nghi: string;
  pham_vi_xu_ly: string;
  dau_moi_xu_ly: string;
  han_xu_ly: string;
  trang_thai: 'Mới tạo' | 'Đã tiếp nhận' | 'Đang xử lý' | 'Hoàn thành' | string;
  ngay_hoan_thanh?: string;
  anh_truoc_url?: string;
  anh_sau_url?: string;
  qua_han: string;
  so_ngay_qua_han: number;
  nguoi_tao: string;
}

export interface DashboardKpi {
  totalPlanned: number;
  surveyed: number;
  completed5S: number;
  passRate: number | string;
  avgImprovement: number | string;
}

export interface OrgScoreSummary {
  to_ha_tang: string;
  scoreBefore: number;
  scoreAfter: number;
}
