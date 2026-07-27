import { Station, SurveyRecord, Recommendation, DashboardKpi, OrgScoreSummary } from '../types';
import { INITIAL_KPIS, INITIAL_ORG_SCORES, INITIAL_STATIONS, INITIAL_RECORDS, INITIAL_RECOMMENDATIONS } from '../data/initialData';

const LOCAL_STORAGE_KEY_URL = 'nhatram5s_appscript_url';
const LOCAL_STORAGE_KEY_STATIONS = 'nhatram5s_stations_data';
const LOCAL_STORAGE_KEY_RECORDS = 'nhatram5s_records_data';
const LOCAL_STORAGE_KEY_RECOMMENDATIONS = 'nhatram5s_recs_data';

export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyy4cCz3jk2IB1GzkbwPH5pxnMMLEQc5XW4TXvRy0KZWzSm3Vh6xKMwa65O1vby5HxqXQ/exec';

export const getAppScriptUrl = (): string => {
  return localStorage.getItem(LOCAL_STORAGE_KEY_URL) || DEFAULT_APPS_SCRIPT_URL;
};

export const setAppScriptUrl = (url: string) => {
  localStorage.setItem(LOCAL_STORAGE_KEY_URL, url.trim());
};

export const loadInitialState = () => {
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_STATIONS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_STATIONS, JSON.stringify(INITIAL_STATIONS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_RECORDS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_RECORDS, JSON.stringify(INITIAL_RECORDS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_RECOMMENDATIONS)) {
    localStorage.setItem(LOCAL_STORAGE_KEY_RECOMMENDATIONS, JSON.stringify(INITIAL_RECOMMENDATIONS));
  }
};

export const fetchDashboardData = async () => {
  const url = getAppScriptUrl();
  loadInitialState();

  if (url) {
    try {
      const response = await fetch(`${url}?action=getAll`);
      const json = await response.json();
      if (json.status === 'success' && json.data) {
        return {
          stations: json.data.stations?.length ? json.data.stations : getLocalStations(),
          records: json.data.records?.length ? json.data.records : getLocalRecords(),
          recommendations: json.data.recommendations?.length ? json.data.recommendations : getLocalRecommendations(),
          kpis: json.data.stats || INITIAL_KPIS,
          orgScores: INITIAL_ORG_SCORES,
          isLive: true
        };
      }
    } catch (err) {
      console.warn('Cannot fetch from Google Apps Script, fallback to local dataset:', err);
    }
  }

  return {
    stations: getLocalStations(),
    records: getLocalRecords(),
    recommendations: getLocalRecommendations(),
    kpis: INITIAL_KPIS,
    orgScores: INITIAL_ORG_SCORES,
    isLive: false
  };
};

export const getLocalStations = (): Station[] => {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_STATIONS);
  return raw ? JSON.parse(raw) : INITIAL_STATIONS;
};

export const getLocalRecords = (): SurveyRecord[] => {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_RECORDS);
  return raw ? JSON.parse(raw) : INITIAL_RECORDS;
};

export const getLocalRecommendations = (): Recommendation[] => {
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_RECOMMENDATIONS);
  return raw ? JSON.parse(raw) : INITIAL_RECOMMENDATIONS;
};

export const saveSurveyForm = async (record: Partial<SurveyRecord>) => {
  const url = getAppScriptUrl();
  const currentRecords = getLocalRecords();
  const currentRecs = getLocalRecommendations();

  const totalAfter = (record.s1_sau || 0) + (record.s2_sau || 0) + (record.s3_sau || 0) + (record.s4_sau || 0) + (record.s5_sau || 0);
  let xepLoaiSau = 'Chưa đạt';
  if (totalAfter >= 90) xepLoaiSau = 'Tiêu biểu';
  else if (totalAfter >= 80) xepLoaiSau = 'Đạt yêu cầu';
  else if (totalAfter >= 70) xepLoaiSau = 'Cần cải thiện';

  const newRecord: SurveyRecord = {
    id_ho_so: 'HS' + String(currentRecords.length + 1).padStart(4, '0'),
    id_nha_tram: record.id_nha_tram || 'NT0001',
    ma_nha_tram: record.ma_nha_tram || 'TPO-0215',
    ten_nha_tram: record.ten_nha_tram || 'BTS Trung tâm Việt Trì',
    to_ha_tang: record.to_ha_tang || 'Tổ Hạ tầng Việt Trì',
    ngay_khao_sat: record.ngay_khao_sat || new Date().toLocaleDateString('vi-VN'),
    dot_danh_gia: 'Sau cải thiện',
    nguoi_khao_sat: record.nguoi_khao_sat || 'Nguyễn Văn A',
    email_nguoi_khao_sat: 'viettri.5s@vnpt.vn',
    s1_truoc: record.s1_truoc || 12,
    s2_truoc: record.s2_truoc || 13,
    s3_truoc: record.s3_truoc || 18,
    s4_truoc: record.s4_truoc || 14,
    s5_truoc: record.s5_truoc || 11,
    tong_truoc: (record.s1_truoc || 12) + (record.s2_truoc || 13) + (record.s3_truoc || 18) + (record.s4_truoc || 14) + (record.s5_truoc || 11),
    s1_sau: record.s1_sau || 17,
    s2_sau: record.s2_sau || 18,
    s3_sau: record.s3_sau || 22,
    s4_sau: record.s4_sau || 16,
    s5_sau: record.s5_sau || 14,
    tong_sau: totalAfter,
    muc_cai_thien: totalAfter - ((record.s1_truoc || 12) + (record.s2_truoc || 13) + (record.s3_truoc || 18) + (record.s4_truoc || 14) + (record.s5_truoc || 11)),
    xep_loai_truoc: 'Chưa đạt',
    xep_loai_sau: xepLoaiSau,
    nguy_co_nghiem_trong: record.noi_dung_kien_nghi ? 'Có' : 'Không',
    duoc_cong_nhan: 'Có',
    noi_dung_thuc_hien: record.noi_dung_thuc_hien || 'Hoàn thành khảo sát 5S',
    ngay_hoan_thanh: new Date().toLocaleDateString('vi-VN'),
    ngay_tai_kiem_tra: record.ngay_tai_kiem_tra || '27/08/2026',
    trang_thai_ho_so: 'Hoàn thành',
    canh_bao_tai_kiem_tra: 'Đúng hạn',
    noi_dung_kien_nghi: record.noi_dung_kien_nghi,
    muc_uu_tien: record.muc_uu_tien || 'Cao'
  };

  const updatedRecords = [newRecord, ...currentRecords];
  localStorage.setItem(LOCAL_STORAGE_KEY_RECORDS, JSON.stringify(updatedRecords));

  if (record.noi_dung_kien_nghi) {
    const newRec: Recommendation = {
      id_kien_nghi: 'KN' + String(currentRecs.length + 1).padStart(4, '0'),
      id_ho_so: newRecord.id_ho_so,
      id_nha_tram: newRecord.id_nha_tram,
      ma_nha_tram: newRecord.ma_nha_tram,
      to_ha_tang: newRecord.to_ha_tang,
      ngay_phat_hien: newRecord.ngay_khao_sat,
      loai_nguy_co: 'Thực bì - nguy cơ cháy',
      muc_uu_tien: record.muc_uu_tien || 'Cao',
      noi_dung_kien_nghi: record.noi_dung_kien_nghi,
      pham_vi_xu_ly: 'Chuyển chuyên môn',
      dau_moi_xu_ly: 'Bộ phận chuyên môn',
      han_xu_ly: record.ngay_tai_kiem_tra || '05/08/2026',
      trang_thai: 'Đang xử lý',
      qua_han: 'Không',
      so_ngay_qua_han: 0,
      nguoi_tao: 'viettri.5s@vnpt.vn'
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_RECOMMENDATIONS, JSON.stringify([newRec, ...currentRecs]));
  }

  // Also post to Google Apps Script if URL exists
  if (url) {
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveSurvey', data: record })
      });
    } catch (e) {
      console.warn('Apps Script post error:', e);
    }
  }

  return newRecord;
};
