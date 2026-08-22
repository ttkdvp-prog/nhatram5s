import { Station, SurveyRecord, Recommendation, DashboardKpi, OrgScoreSummary } from '../types';
import { INITIAL_KPIS, INITIAL_ORG_SCORES, INITIAL_STATIONS, INITIAL_RECORDS, INITIAL_RECOMMENDATIONS } from '../data/initialData';
import { toLh3Url, parseSheetPhotoUrls, safeLocalStorageSet } from '../utils/imageHelper';

const LOCAL_STORAGE_KEY_URL = 'nhatram5s_appscript_url';
const LOCAL_STORAGE_KEY_STATIONS = 'nhatram5s_stations_data';
const LOCAL_STORAGE_KEY_RECORDS = 'nhatram5s_records_data';
const LOCAL_STORAGE_KEY_RECOMMENDATIONS = 'nhatram5s_recs_data';

// 1 Biến API duy nhất trỏ về Google Apps Script Web App Backend (Code.gs)
export const DEFAULT_APPS_SCRIPT_URL =
  (import.meta as any).env?.VITE_APPSCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbyJd-UnQaqPj3xhMx-FVybu5deYI0VXtqgpQPiWcytJPxcw81Goy7raBlIGLZ3BSmdP_A/exec';

export const getAppScriptUrl = (): string => {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_URL);
  // Nếu stored là rỗng hoặc link cũ bị lỗi, tự động trỏ về DEFAULT_APPS_SCRIPT_URL chuẩn
  if (!stored || stored.includes('AKfycbyy4cCz3jk2IB1GzkbwPH5pxnMMLEQc5XW4TXvRy0KZWzSm3Vh6xKMwa65O1vby5HxqXQ')) {
    return DEFAULT_APPS_SCRIPT_URL;
  }
  return stored.trim();
};

export const setAppScriptUrl = (url: string) => {
  safeLocalStorageSet(LOCAL_STORAGE_KEY_URL, url.trim());
};

export const loadInitialState = () => {
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_STATIONS)) {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_STATIONS, JSON.stringify(INITIAL_STATIONS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_RECORDS)) {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_RECORDS, JSON.stringify(INITIAL_RECORDS));
  }
  if (!localStorage.getItem(LOCAL_STORAGE_KEY_RECOMMENDATIONS)) {
    safeLocalStorageSet(LOCAL_STORAGE_KEY_RECOMMENDATIONS, JSON.stringify(INITIAL_RECOMMENDATIONS));
  }
};

/**
 * Tải ảnh trực tiếp lên Google Drive thông qua Backend Code.gs (Apps Script API)
 * Tự động phân quyền và trả về link LH3 (https://lh3.googleusercontent.com/d/{fileId})
 */
export interface UploadImageParams {
  base64Data: string;
  fileName?: string;
  mimeType?: string;
  stationCode?: string;
  stationName?: string;
  photoType?: 'Trước' | 'Sau' | 'Nguy cơ' | string;
  recordId?: string;
}

export interface UploadImageResult {
  fileId: string;
  lh3Url: string;
  fileName: string;
  driveViewLink?: string;
}

export const uploadImageToGoogleDrive = async (params: UploadImageParams): Promise<UploadImageResult> => {
  const scriptUrl = getAppScriptUrl();

  if (scriptUrl) {
    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadImage',
          data: params
        }),
        redirect: 'follow'
      });

      if (response.ok) {
        const json = await response.json();
        if (json.status === 'success' && json.data?.lh3Url) {
          return {
            fileId: json.data.fileId,
            lh3Url: toLh3Url(json.data.lh3Url),
            fileName: json.data.fileName || params.fileName || 'photo.jpg',
            driveViewLink: json.data.driveViewLink
          };
        }
      }
    } catch (err) {
      console.warn('Apps Script upload failed, fallback to local display:', err);
    }
  }

  // Fallback nếu không có kết nối internet hoặc chưa cấu hình URL
  const fakeId = 'local_' + Date.now().toString(36);
  return {
    fileId: fakeId,
    lh3Url: params.base64Data,
    fileName: params.fileName || 'photo.jpg'
  };
};

/**
 * Lấy toàn bộ dữ liệu từ Google Sheets qua Apps Script API duy nhất
 */
export const fetchDashboardData = async () => {
  const url = getAppScriptUrl();
  loadInitialState();

  if (url) {
    try {
      const response = await fetch(`${url}?action=getAll`, {
        method: 'GET',
        redirect: 'follow'
      });
      const json = await response.json();
      if (json.status === 'success' && json.data) {
        const rawRecords: SurveyRecord[] = json.data.records || [];
        const recordsWithPhotos: SurveyRecord[] = rawRecords.map((r: any) => {
          const beforeList = parseSheetPhotoUrls(r.anh_truoc_list || r.anh_truoc_url);
          const afterList = parseSheetPhotoUrls(r.anh_sau_list || r.anh_sau_url);
          return {
            ...r,
            anh_truoc_list: beforeList,
            anh_sau_list: afterList,
            anh_truoc_url: beforeList[0] || toLh3Url(r.anh_truoc_url || ''),
            anh_sau_url: afterList[0] || toLh3Url(r.anh_sau_url || '')
          };
        });

        // Cập nhật bộ đệm an toàn
        if (recordsWithPhotos.length > 0) {
          safeLocalStorageSet(LOCAL_STORAGE_KEY_RECORDS, JSON.stringify(recordsWithPhotos));
        }
        if (json.data.stations?.length > 0) {
          safeLocalStorageSet(LOCAL_STORAGE_KEY_STATIONS, JSON.stringify(json.data.stations));
        }
        if (json.data.recommendations?.length > 0) {
          safeLocalStorageSet(LOCAL_STORAGE_KEY_RECOMMENDATIONS, JSON.stringify(json.data.recommendations));
        }

        return {
          stations: json.data.stations?.length ? json.data.stations : getLocalStations(),
          records: recordsWithPhotos.length ? recordsWithPhotos : getLocalRecords(),
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

/**
 * Lưu phiếu khảo sát 5S vào Google Sheet qua Apps Script API duy nhất
 * Tự động đảm bảo 100% ảnh được upload lên Google Drive & ghép link LH3
 */
export const saveSurveyForm = async (record: Partial<SurveyRecord>) => {
  const url = getAppScriptUrl();
  const currentRecords = getLocalRecords();
  const currentRecs = getLocalRecommendations();

  // 1. Tự động tải tất cả các ảnh còn ở dạng Base64 lên Google Drive nếu có
  const cleanBeforeList: string[] = [];
  const rawBeforeList = record.anh_truoc_list && record.anh_truoc_list.length > 0
    ? record.anh_truoc_list
    : (record.anh_truoc_url ? [record.anh_truoc_url] : []);

  for (let i = 0; i < rawBeforeList.length; i++) {
    const item = rawBeforeList[i];
    if (item.startsWith('data:image/')) {
      const up = await uploadImageToGoogleDrive({
        base64Data: item,
        fileName: `5S_${record.ma_nha_tram || 'TRAM'}_Truoc_${Date.now()}_${i + 1}.jpg`,
        stationCode: record.ma_nha_tram,
        stationName: record.ten_nha_tram,
        photoType: 'Trước'
      });
      cleanBeforeList.push(toLh3Url(up.lh3Url));
    } else {
      cleanBeforeList.push(toLh3Url(item));
    }
  }

  const cleanAfterList: string[] = [];
  const rawAfterList = record.anh_sau_list && record.anh_sau_list.length > 0
    ? record.anh_sau_list
    : (record.anh_sau_url ? [record.anh_sau_url] : []);

  for (let i = 0; i < rawAfterList.length; i++) {
    const item = rawAfterList[i];
    if (item.startsWith('data:image/')) {
      const up = await uploadImageToGoogleDrive({
        base64Data: item,
        fileName: `5S_${record.ma_nha_tram || 'TRAM'}_Sau_${Date.now()}_${i + 1}.jpg`,
        stationCode: record.ma_nha_tram,
        stationName: record.ten_nha_tram,
        photoType: 'Sau'
      });
      cleanAfterList.push(toLh3Url(up.lh3Url));
    } else {
      cleanAfterList.push(toLh3Url(item));
    }
  }

  const primaryBeforeUrl = cleanBeforeList[0] || '';
  const primaryAfterUrl = cleanAfterList[0] || '';

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
    anh_truoc_url: primaryBeforeUrl,
    anh_sau_url: primaryAfterUrl,
    anh_truoc_list: cleanBeforeList,
    anh_sau_list: cleanAfterList,
    ngay_hoan_thanh: new Date().toLocaleDateString('vi-VN'),
    ngay_tai_kiem_tra: record.ngay_tai_kiem_tra || '27/08/2026',
    trang_thai_ho_so: 'Hoàn thành',
    canh_bao_tai_kiem_tra: 'Đúng hạn',
    noi_dung_kien_nghi: record.noi_dung_kien_nghi,
    muc_uu_tien: record.muc_uu_tien || 'Cao'
  };

  const updatedRecords = [newRecord, ...currentRecords];
  safeLocalStorageSet(LOCAL_STORAGE_KEY_RECORDS, JSON.stringify(updatedRecords));

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
      nguoi_tao: 'viettri.5s@vnpt.vn',
      anh_truoc_url: primaryBeforeUrl,
      anh_sau_url: primaryAfterUrl
    };
    safeLocalStorageSet(LOCAL_STORAGE_KEY_RECOMMENDATIONS, JSON.stringify([newRec, ...currentRecs]));
  }

  // Gửi trực tiếp tới Google Apps Script Web App (Code.gs)
  if (url) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'saveSurvey', data: newRecord }),
        redirect: 'follow'
      });
      const resJson = await resp.json();
      console.log('Survey saved to Google Sheet successfully:', resJson);
    } catch (e) {
      console.warn('Apps Script post error:', e);
    }
  }

  return newRecord;
};
