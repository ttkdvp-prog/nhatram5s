import React, { useState, useRef, useEffect } from 'react';
import { Station, SurveyRecord } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Save,
  Camera,
  CheckCircle,
  AlertTriangle,
  Building2,
  Sparkles,
  Upload,
  X,
  QrCode,
  Download,
  Eye,
  Trash2,
  ImageOff,
  Link2,
  Copy,
  ExternalLink,
  Loader2,
  Check,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { toLh3Url, extractDriveFileId, isDriveOrLh3Url, compressImageFile, safeLocalStorageSet } from '../utils/imageHelper';
import { uploadImageToGoogleDrive } from '../services/api';
import { ImageLightbox, LightboxPhoto } from './ImageLightbox';
import { CANONICAL_ORGS, getDefaultSurveyor } from '../data/initialData';
import { SearchableCombobox } from './SearchableCombobox';

interface SurveyFormViewProps {
  stations: Station[];
  onSave: (record: Partial<SurveyRecord>) => Promise<any> | void;
  initialRecord?: SurveyRecord | null;
}

const getStoredPhotos = (code: string) => {
  const key = `nhatram5s_photos_${code}`;
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try {
      const parsed = JSON.parse(saved);
      return {
        before: Array.isArray(parsed.beforePhotos) ? parsed.beforePhotos.map(toLh3Url) : [],
        after: Array.isArray(parsed.afterPhotos) ? parsed.afterPhotos.map(toLh3Url) : []
      };
    } catch (e) {}
  }
  return {
    before: [],
    after: []
  };
};

export const SurveyFormView: React.FC<SurveyFormViewProps> = ({
  stations,
  onSave,
  initialRecord
}) => {
  const defaultStation = stations[0] || {
    ma_nha_tram: 'TPO-0215',
    ten_nha_tram: 'BTS Trung tâm Việt Trì',
    to_ha_tang: 'Tổ Hạ tầng Việt Trì'
  };

  // Form State
  const [selectedStationCode, setSelectedStationCode] = useState(initialRecord?.ma_nha_tram || defaultStation.ma_nha_tram);
  const [selectedStationName, setSelectedStationName] = useState(initialRecord?.ten_nha_tram || defaultStation.ten_nha_tram);
  const [toHaTang, setToHaTang] = useState(
    initialRecord?.to_ha_tang ? initialRecord.to_ha_tang.replace('Tổ Hạ tầng ', '') : defaultStation.to_ha_tang.replace('Tổ Hạ tầng ', '')
  );
  const [selectedManager, setSelectedManager] = useState<string>(() => {
    if (initialRecord) {
      const found = stations.find(s => s.ma_nha_tram === initialRecord.ma_nha_tram);
      if (found?.nguoi_phu_trach) return found.nguoi_phu_trach;
    }
    return defaultStation.nguoi_phu_trach || '';
  });
  const [surveyDate, setSurveyDate] = useState(initialRecord?.ngay_khao_sat || new Date().toLocaleDateString('vi-VN'));
  const [surveyor, setSurveyor] = useState(
    initialRecord?.nguoi_khao_sat || getDefaultSurveyor(initialRecord?.to_ha_tang || defaultStation.to_ha_tang)
  );

  // 5S Score Inputs
  const [s1Before, setS1Before] = useState<number>(initialRecord?.s1_truoc ?? 12);
  const [s2Before, setS2Before] = useState<number>(initialRecord?.s2_truoc ?? 13);
  const [s3Before, setS3Before] = useState<number>(initialRecord?.s3_truoc ?? 18);
  const [s4Before, setS4Before] = useState<number>(initialRecord?.s4_truoc ?? 14);
  const [s5Before, setS5Before] = useState<number>(initialRecord?.s5_truoc ?? 11);

  const [s1After, setS1After] = useState<number>(initialRecord?.s1_sau ?? 17);
  const [s2After, setS2After] = useState<number>(initialRecord?.s2_sau ?? 18);
  const [s3After, setS3After] = useState<number>(initialRecord?.s3_sau ?? 22);
  const [s4After, setS4After] = useState<number>(initialRecord?.s4_sau ?? 16);
  const [s5After, setS5After] = useState<number>(initialRecord?.s5_sau ?? 14);

  // Risk and recommendations
  const [riskContent, setRiskContent] = useState(initialRecord?.noi_dung_kien_nghi || '');
  const [priority, setPriority] = useState(initialRecord?.muc_uu_tien || 'Cao');
  const [assignedDept, setAssignedDept] = useState('Bộ phận chuyên môn');
  const [executionLog, setExecutionLog] = useState(initialRecord?.noi_dung_thuc_hien || '');

  // Photo state with LH3 URLs
  const [beforePhotos, setBeforePhotos] = useState<string[]>(() => {
    if (initialRecord?.anh_truoc_list && initialRecord.anh_truoc_list.length > 0) {
      return initialRecord.anh_truoc_list.map(toLh3Url);
    }
    if (initialRecord?.anh_truoc_url) {
      return [toLh3Url(initialRecord.anh_truoc_url)];
    }
    return getStoredPhotos(defaultStation.ma_nha_tram).before;
  });

  const [afterPhotos, setAfterPhotos] = useState<string[]>(() => {
    if (initialRecord?.anh_sau_list && initialRecord.anh_sau_list.length > 0) {
      return initialRecord.anh_sau_list.map(toLh3Url);
    }
    if (initialRecord?.anh_sau_url) {
      return [toLh3Url(initialRecord.anh_sau_url)];
    }
    return getStoredPhotos(defaultStation.ma_nha_tram).after;
  });

  // Uploading and saving states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);

  // Paste Drive Link Modal state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteType, setPasteType] = useState<'Trước' | 'Sau'>('Trước');
  const [pastedUrlInput, setPastedUrlInput] = useState('');

  // Track failed image URLs
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const handleImageError = (url: string) => {
    setFailedImages(prev => ({ ...prev, [url]: true }));
  };

  // Đồng bộ khi initialRecord thay đổi từ bên ngoài
  useEffect(() => {
    if (initialRecord) {
      setSelectedStationCode(initialRecord.ma_nha_tram);
      setSelectedStationName(initialRecord.ten_nha_tram);
      setToHaTang(initialRecord.to_ha_tang ? initialRecord.to_ha_tang.replace('Tổ Hạ tầng ', '') : '');
      const matched = stations.find(s => s.ma_nha_tram === initialRecord.ma_nha_tram);
      if (matched?.nguoi_phu_trach) {
        setSelectedManager(matched.nguoi_phu_trach);
      }
      setSurveyDate(initialRecord.ngay_khao_sat || new Date().toLocaleDateString('vi-VN'));
      setSurveyor(initialRecord.nguoi_khao_sat || 'Nguyễn Văn A');
      setS1Before(initialRecord.s1_truoc ?? 0);
      setS2Before(initialRecord.s2_truoc ?? 0);
      setS3Before(initialRecord.s3_truoc ?? 0);
      setS4Before(initialRecord.s4_truoc ?? 0);
      setS5Before(initialRecord.s5_truoc ?? 0);
      setS1After(initialRecord.s1_sau ?? 0);
      setS2After(initialRecord.s2_sau ?? 0);
      setS3After(initialRecord.s3_sau ?? 0);
      setS4After(initialRecord.s4_sau ?? 0);
      setS5After(initialRecord.s5_sau ?? 0);
      setRiskContent(initialRecord.noi_dung_kien_nghi || '');
      setPriority(initialRecord.muc_uu_tien || 'Cao');
      setExecutionLog(initialRecord.noi_dung_thuc_hien || '');
      const bList = initialRecord.anh_truoc_list?.length ? initialRecord.anh_truoc_list : (initialRecord.anh_truoc_url ? [initialRecord.anh_truoc_url] : []);
      const aList = initialRecord.anh_sau_list?.length ? initialRecord.anh_sau_list : (initialRecord.anh_sau_url ? [initialRecord.anh_sau_url] : []);
      setBeforePhotos(bList.map(toLh3Url));
      setAfterPhotos(aList.map(toLh3Url));
    }
  }, [initialRecord, stations]);

  // Sync photos to localStorage on state changes
  useEffect(() => {
    const safeBefore = beforePhotos.filter(u => !u.startsWith('data:image/'));
    const safeAfter = afterPhotos.filter(u => !u.startsWith('data:image/'));
    safeLocalStorageSet(
      `nhatram5s_photos_${selectedStationCode}`,
      JSON.stringify({ beforePhotos: safeBefore, afterPhotos: safeAfter })
    );
  }, [beforePhotos, afterPhotos, selectedStationCode]);

  // File input refs for uploading
  const beforeFileInputRef = useRef<HTMLInputElement | null>(null);
  const afterFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const openBeforeLightbox = (index: number) => {
    const photos: LightboxPhoto[] = [
      ...beforePhotos.map((u, i) => ({ url: u, title: `Ảnh hiện trạng trước 5S #${i + 1}`, type: 'Trước' as const, stationCode: selectedStationCode })),
      ...afterPhotos.map((u, i) => ({ url: u, title: `Ảnh kết quả sau 5S #${i + 1}`, type: 'Sau' as const, stationCode: selectedStationCode }))
    ];
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  const openAfterLightbox = (index: number) => {
    const photos: LightboxPhoto[] = [
      ...beforePhotos.map((u, i) => ({ url: u, title: `Ảnh hiện trạng trước 5S #${i + 1}`, type: 'Trước' as const, stationCode: selectedStationCode })),
      ...afterPhotos.map((u, i) => ({ url: u, title: `Ảnh kết quả sau 5S #${i + 1}`, type: 'Sau' as const, stationCode: selectedStationCode }))
    ];
    setLightboxPhotos(photos);
    setLightboxIndex(beforePhotos.length + index);
    setIsLightboxOpen(true);
  };

  // Calculate totals
  const totalBefore = s1Before + s2Before + s3Before + s4Before + s5Before;
  const totalAfter = s1After + s2After + s3After + s4After + s5After;

  // Rating badge
  let ratingBadge = 'ĐẠT';
  let ratingColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  if (totalAfter >= 90) {
    ratingBadge = 'TIÊU BIỂU';
    ratingColor = 'bg-blue-100 text-blue-800 border-blue-300';
  } else if (totalAfter < 70) {
    ratingBadge = 'CẦN CẢI THIỆN';
    ratingColor = 'bg-amber-100 text-amber-800 border-amber-300';
  }

  const liveOrgs = Array.from(new Set(stations.map((s) => s.to_ha_tang).filter(Boolean)));
  const availableOrgs = liveOrgs.length > 0 ? liveOrgs.sort() : CANONICAL_ORGS;

  const currentCleanOrg = toHaTang.replace('Tổ Hạ tầng ', '').trim();

  // Danh sách nhân viên quản lý theo Tổ Hạ tầng đang chọn
  const stationsInCurrentOrg = stations.filter(
    (s) => !currentCleanOrg || currentCleanOrg === 'Tất cả' || s.to_ha_tang.includes(currentCleanOrg)
  );

  const availableManagers = Array.from(
    new Set(stationsInCurrentOrg.map((s) => s.nguoi_phu_trach).filter(Boolean))
  ).sort();

  // Danh sách trạm lọc theo Tổ Hạ tầng VÀ Nhân viên quản lý
  const filteredStations = stations.filter((s) => {
    const matchOrg = !currentCleanOrg || currentCleanOrg === 'Tất cả' || s.to_ha_tang.includes(currentCleanOrg);
    const matchMgr = !selectedManager || selectedManager === 'Tất cả' || s.nguoi_phu_trach === selectedManager;
    return matchOrg && matchMgr;
  });

  const handleOrgChange = (newOrg: string) => {
    const cleanOrg = newOrg.replace('Tổ Hạ tầng ', '').trim();
    setToHaTang(cleanOrg);

    // Tự động gán mặc định tên Tổ trưởng của tổ được chọn
    const defaultLeader = getDefaultSurveyor(newOrg);
    setSurveyor(defaultLeader);

    const stInOrg = stations.filter(
      (s) => !cleanOrg || cleanOrg === 'Tất cả' || s.to_ha_tang.includes(cleanOrg)
    );
    const mgrsInOrg = Array.from(new Set(stInOrg.map((s) => s.nguoi_phu_trach).filter(Boolean)));
    
    let newMgr = selectedManager;
    if (selectedManager !== 'Tất cả' && !mgrsInOrg.includes(selectedManager)) {
      newMgr = mgrsInOrg[0] || 'Tất cả';
      setSelectedManager(newMgr);
    }

    const validStations = stations.filter((s) => {
      const matchOrg = !cleanOrg || cleanOrg === 'Tất cả' || s.to_ha_tang.includes(cleanOrg);
      const matchMgr = !newMgr || newMgr === 'Tất cả' || s.nguoi_phu_trach === newMgr;
      return matchOrg && matchMgr;
    });

    if (validStations.length > 0) {
      const isStillValid = validStations.some((s) => s.ma_nha_tram === selectedStationCode);
      if (!isStillValid) {
        handleStationChange(validStations[0].ma_nha_tram);
      }
    }
  };

  const handleManagerChange = (newMgr: string) => {
    setSelectedManager(newMgr);
    const validStations = stations.filter((s) => {
      const matchOrg = !currentCleanOrg || currentCleanOrg === 'Tất cả' || s.to_ha_tang.includes(currentCleanOrg);
      const matchMgr = !newMgr || newMgr === 'Tất cả' || s.nguoi_phu_trach === newMgr;
      return matchOrg && matchMgr;
    });

    if (validStations.length > 0) {
      const isStillValid = validStations.some((s) => s.ma_nha_tram === selectedStationCode);
      if (!isStillValid) {
        handleStationChange(validStations[0].ma_nha_tram);
      }
    }
  };

  const handleStationChange = (code: string) => {
    setSelectedStationCode(code);
    const found = stations.find((s) => s.ma_nha_tram === code);
    if (found) {
      setSelectedStationName(found.ten_nha_tram);
      setToHaTang(found.to_ha_tang.replace('Tổ Hạ tầng ', ''));
      if (found.nguoi_phu_trach && selectedManager !== 'Tất cả' && selectedManager !== found.nguoi_phu_trach) {
        setSelectedManager(found.nguoi_phu_trach);
      }
    }
    const stored = getStoredPhotos(code);
    setBeforePhotos(stored.before.map(toLh3Url));
    setAfterPhotos(stored.after.map(toLh3Url));
  };

  // Làm mới hoàn toàn form về trạng thái trắng sạch
  const handleResetForm = () => {
    const st = stations.find(s => s.ma_nha_tram === selectedStationCode) || defaultStation;
    setSelectedStationCode(st.ma_nha_tram);
    setSelectedStationName(st.ten_nha_tram);
    setToHaTang(st.to_ha_tang.replace('Tổ Hạ tầng ', ''));
    if (st.nguoi_phu_trach) {
      setSelectedManager(st.nguoi_phu_trach);
    }
    setSurveyDate(new Date().toLocaleDateString('vi-VN'));
    setSurveyor(getDefaultSurveyor(st.to_ha_tang));
    setS1Before(0);
    setS2Before(0);
    setS3Before(0);
    setS4Before(0);
    setS5Before(0);
    setS1After(0);
    setS2After(0);
    setS3After(0);
    setS4After(0);
    setS5After(0);
    setRiskContent('');
    setPriority('Cao');
    setExecutionLog('');
    setBeforePhotos([]);
    setAfterPhotos([]);
    localStorage.removeItem(`nhatram5s_photos_${selectedStationCode}`);
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 2500);
  };

  // Process File Upload to Google Drive and convert to LH3 Link (Tự động nén ảnh nhanh 30x)
  const processUpload = async (files: FileList | null, photoType: 'Trước' | 'Sau') => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const totalFiles = files.length;
    let completed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatusMsg(`Đang nén & tải ảnh ${i + 1}/${totalFiles} lên Google Drive...`);

      try {
        const compressedBase64 = await compressImageFile(file, 1600, 1600, 0.8);

        const uploadResult = await uploadImageToGoogleDrive({
          base64Data: compressedBase64,
          fileName: `5S_${selectedStationCode}_${photoType}_${Date.now()}_${i + 1}.jpg`,
          mimeType: 'image/jpeg',
          stationCode: selectedStationCode,
          stationName: selectedStationName,
          photoType: photoType
        });

        const lh3Link = toLh3Url(uploadResult.lh3Url);
        if (photoType === 'Trước') {
          setBeforePhotos(prev => [...prev, lh3Link]);
        } else {
          setAfterPhotos(prev => [...prev, lh3Link]);
        }
        completed++;
      } catch (err) {
        console.error('Lỗi khi tải ảnh lên Google Drive:', err);
      }
    }

    setUploadStatusMsg(`Đã tải thành công ${completed}/${totalFiles} ảnh Google Drive dạng link LH3!`);
    setTimeout(() => {
      setIsUploading(false);
      setUploadStatusMsg('');
    }, 2000);
  };

  const handleBeforeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processUpload(e.target.files, 'Trước');
    if (e.target) e.target.value = '';
  };

  const handleAfterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processUpload(e.target.files, 'Sau');
    if (e.target) e.target.value = '';
  };

  // Thêm ảnh từ link Google Drive hoặc link bất kỳ
  const handleAddPastedLink = () => {
    if (!pastedUrlInput.trim()) return;

    const lh3Link = toLh3Url(pastedUrlInput.trim());
    if (pasteType === 'Trước') {
      setBeforePhotos(prev => [...prev, lh3Link]);
    } else {
      setAfterPhotos(prev => [...prev, lh3Link]);
    }

    setPastedUrlInput('');
    setIsPasteModalOpen(false);
  };

  const removeBeforePhoto = (index: number) => {
    setBeforePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeAfterPhoto = (index: number) => {
    setAfterPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllBeforePhotos = () => {
    setBeforePhotos([]);
  };

  const removeAllAfterPhotos = () => {
    setAfterPhotos([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const cleanBefore = beforePhotos.map(toLh3Url);
    const cleanAfter = afterPhotos.map(toLh3Url);

    try {
      await onSave({
        id_ho_so: initialRecord?.id_ho_so,
        ma_nha_tram: selectedStationCode,
        ten_nha_tram: selectedStationName,
        to_ha_tang: `Tổ Hạ tầng ${toHaTang.replace('Tổ Hạ tầng ', '')}`,
        ngay_khao_sat: surveyDate,
        nguoi_khao_sat: surveyor,
        s1_truoc: Number(s1Before) || 0,
        s2_truoc: Number(s2Before) || 0,
        s3_truoc: Number(s3Before) || 0,
        s4_truoc: Number(s4Before) || 0,
        s5_truoc: Number(s5Before) || 0,
        s1_sau: Number(s1After) || 0,
        s2_sau: Number(s2After) || 0,
        s3_sau: Number(s3After) || 0,
        s4_sau: Number(s4After) || 0,
        s5_sau: Number(s5After) || 0,
        noi_dung_kien_nghi: riskContent,
        muc_uu_tien: priority,
        noi_dung_thuc_hien: executionLog,
        anh_truoc_url: cleanBefore[0] || '',
        anh_sau_url: cleanAfter[0] || '',
        anh_truoc_list: cleanBefore,
        anh_sau_list: cleanAfter
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error('Lỗi khi lưu phiếu khảo sát:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={beforeFileInputRef}
        onChange={handleBeforeUpload}
        accept="image/*"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={afterFileInputRef}
        onChange={handleAfterUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Form Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>Phiếu khảo sát và đánh giá Nhà trạm 5S</span>
            {initialRecord && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800">
                Sửa: {initialRecord.id_ho_so}
              </span>
            )}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleResetForm}
            disabled={isSaving || isUploading}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-300 disabled:opacity-50 cursor-pointer"
            title="Xóa trắng để tạo phiếu khảo sát mới"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>LÀM MỚI PHIẾU</span>
          </button>

          <button
            type="submit"
            disabled={isUploading || isSaving}
            className="px-6 py-3 bg-vnpt-500 hover:bg-vnpt-600 active:scale-95 text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-vnpt-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>ĐANG ĐỒNG BỘ GOOGLE SHEETS...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>LƯU PHIẾU VÀ ĐỒNG BỘ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Reset Notification */}
      {resetNotice && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-2xl p-4 flex items-center space-x-3 text-sm font-bold animate-in fade-in duration-200">
          <CheckCircle className="w-5 h-5 text-sky-600" />
          <span>Đã làm mới form khảo sát! Mọi trường dữ liệu và ảnh đã được reset sạch sẽ.</span>
        </div>
      )}

      {/* Upload Progress Indicator */}
      {isUploading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-2xl p-4 flex items-center space-x-3 text-sm font-bold animate-pulse">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          <span>{uploadStatusMsg}</span>
        </div>
      )}

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl p-4 flex items-center space-x-3 text-sm font-bold animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span>Đã lưu phiếu khảo sát 5S và đồng bộ thành công lên Google Sheets & Drive!</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Thông tin nhà trạm */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
            <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-vnpt-500" />
              <span>Thông tin nhà trạm</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Tổ Hạ tầng */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Tổ Hạ tầng <span className="text-vnpt-600 font-bold">*</span>
                </label>
                <select
                  value={toHaTang ? (toHaTang.startsWith('Tổ Hạ tầng') ? toHaTang : `Tổ Hạ tầng ${toHaTang}`) : 'Tổ Hạ tầng Việt Trì'}
                  onChange={(e) => handleOrgChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500 text-sm cursor-pointer"
                >
                  <option value="Tất cả">Tất cả các Tổ Hạ tầng</option>
                  {availableOrgs.map((org) => (
                    <option key={org} value={org}>
                      {org.startsWith('Tổ Hạ tầng') ? org : `Tổ Hạ tầng ${org}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Tên nhân viên quản lý nhà trạm (Tìm kiếm thông minh, hỗ trợ viết tắt) */}
              <div>
                <SearchableCombobox
                  label="Tên nhân viên quản lý nhà trạm"
                  required={true}
                  value={selectedManager}
                  onChange={handleManagerChange}
                  placeholder="Gõ tên nhân viên hoặc viết tắt (vd: nva, anh, le...)"
                  emptyText="Không tìm thấy nhân viên phù hợp"
                  options={[
                    { value: 'Tất cả', label: `Tất cả nhân viên (${availableManagers.length})` },
                    ...availableManagers.map((mgr) => {
                      const managedCount = stations.filter((s) => s.nguoi_phu_trach === mgr).length;
                      const sampleStation = stations.find((s) => s.nguoi_phu_trach === mgr);
                      return {
                        value: mgr,
                        label: mgr,
                        subLabel: `${managedCount} nhà trạm quản lý`,
                        badge: sampleStation?.ma_nv
                      };
                    })
                  ]}
                />
              </div>

              {/* 3. Mã nhà trạm (Tìm kiếm thông minh theo mã hoặc tên trạm) */}
              <div>
                <SearchableCombobox
                  label={`Mã nhà trạm (${filteredStations.length} trạm)`}
                  required={true}
                  value={selectedStationCode}
                  onChange={handleStationChange}
                  placeholder="Gõ mã trạm, tên trạm hoặc viết tắt (vd: tpo, 0215, viettri...)"
                  emptyText="Không tìm thấy nhà trạm phù hợp"
                  options={(filteredStations.length > 0 ? filteredStations : stations).map((s) => ({
                    value: s.ma_nha_tram,
                    label: s.ma_nha_tram,
                    subLabel: s.ten_nha_tram,
                    badge: s.to_ha_tang ? s.to_ha_tang.replace('Tổ Hạ tầng ', '') : undefined
                  }))}
                />
              </div>

              {/* 4. Mã NV quản lý trạm */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mã NV quản lý trạm</label>
                <input
                  type="text"
                  readOnly
                  value={stations.find(s => s.ma_nha_tram === selectedStationCode)?.ma_nv || 'NV_PTO_012'}
                  className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm cursor-not-allowed font-mono"
                />
              </div>

              {/* 5. Hệ số quy đổi 5S */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Hệ số quy đổi 5S</label>
                <div className="flex items-center px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl">
                  <span className="font-black text-vnpt-700 text-sm">
                    {stations.find(s => s.ma_nha_tram === selectedStationCode)?.he_so_quy_doi ?? 1.0}
                  </span>
                  <span className="text-xs font-bold text-slate-500 ml-1">x (Hệ số trạm)</span>
                </div>
              </div>

              {/* 6. Ngày khảo sát */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ngày khảo sát</label>
                <input
                  type="text"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500 text-sm"
                />
              </div>

              {/* 7. Người khảo sát */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">
                  Người khảo sát (Đoàn kiểm tra) <span className="text-vnpt-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={surveyor}
                  onChange={(e) => setSurveyor(e.target.value)}
                  placeholder="Nhập tên người khảo sát hoặc chọn gợi ý..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500 text-sm"
                />
                {/* Gợi ý nhanh 1 chạm */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-semibold text-slate-400">Gợi ý nhanh:</span>
                  <button
                    type="button"
                    onClick={() => setSurveyor(getDefaultSurveyor(toHaTang))}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-vnpt-700 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                  >
                    👤 {getDefaultSurveyor(toHaTang)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveyor('Đoàn kiểm tra 5S Trung tâm')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-vnpt-700 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                  >
                    🏢 Đoàn kiểm tra 5S Trung tâm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSurveyor('Đầu mối ATVSV / Công đoàn')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-blue-50 hover:text-vnpt-700 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200 transition-colors cursor-pointer"
                  >
                    🛡️ Đầu mối ATVSV / Công đoàn
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Đánh giá điểm 5S Trước & Sau cải thiện */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-6">
            <h3 className="font-bold text-slate-800 text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-vnpt-500" />
                <span>Đánh giá 5 tiêu chí 5S</span>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                Thang điểm 100
              </span>
            </h3>

            {/* Bảng điểm trước */}
            <div>
              <div className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>1. Điểm số trước cải thiện (Tổng: {totalBefore}/100)</span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-bold text-sky-700">S1 Sàng lọc</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s1Before}
                    onChange={(e) => setS1Before(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-slate-200 rounded-lg py-1 mt-1"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">/20 đ</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-bold text-vnpt-700">S2 Sắp xếp</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s2Before}
                    onChange={(e) => setS2Before(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-slate-200 rounded-lg py-1 mt-1"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">/20 đ</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-bold text-emerald-700">S3 Sạch sẽ</div>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={s3Before}
                    onChange={(e) => setS3Before(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-slate-200 rounded-lg py-1 mt-1"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">/25 đ</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-bold text-amber-700">S4 Săn sóc</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s4Before}
                    onChange={(e) => setS4Before(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-slate-200 rounded-lg py-1 mt-1"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">/20 đ</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
                  <div className="text-[11px] font-bold text-emerald-800">S5 Sẵn sàng</div>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={s5Before}
                    onChange={(e) => setS5Before(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-slate-200 rounded-lg py-1 mt-1"
                  />
                  <div className="text-[9px] text-slate-400 mt-0.5">/15 đ</div>
                </div>
              </div>
            </div>

            {/* Bảng điểm sau */}
            <div>
              <div className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>2. Điểm số sau cải thiện (Tổng: {totalAfter}/100)</span>
                <span className="text-[11px] font-bold text-emerald-600">
                  {totalAfter - totalBefore >= 0 ? `+${totalAfter - totalBefore}` : totalAfter - totalBefore} điểm
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-200">
                  <div className="text-[11px] font-bold text-sky-800">S1 Sàng lọc</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s1After}
                    onChange={(e) => setS1After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-emerald-300 rounded-lg py-1 mt-1 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-[9px] text-emerald-600 mt-0.5">/20 đ</div>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-200">
                  <div className="text-[11px] font-bold text-vnpt-800">S2 Sắp xếp</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s2After}
                    onChange={(e) => setS2After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-emerald-300 rounded-lg py-1 mt-1 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-[9px] text-emerald-600 mt-0.5">/20 đ</div>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800">S3 Sạch sẽ</div>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={s3After}
                    onChange={(e) => setS3After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-emerald-300 rounded-lg py-1 mt-1 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-[9px] text-emerald-600 mt-0.5">/25 đ</div>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-200">
                  <div className="text-[11px] font-bold text-amber-800">S4 Săn sóc</div>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s4After}
                    onChange={(e) => setS4After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-emerald-300 rounded-lg py-1 mt-1 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-[9px] text-emerald-600 mt-0.5">/20 đ</div>
                </div>
                <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-900">S5 Sẵn sàng</div>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={s5After}
                    onChange={(e) => setS5After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-base bg-white border border-emerald-300 rounded-lg py-1 mt-1 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-[9px] text-emerald-600 mt-0.5">/15 đ</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Nguy cơ/kiến nghị & ĐÍNH KÈM ẢNH GOOGLE DRIVE */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Nguy cơ/kiến nghị & Ảnh minh chứng Google Drive</span>
            </h3>

            {/* Alert banner */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2">
              <input
                type="text"
                value={riskContent}
                onChange={(e) => setRiskContent(e.target.value)}
                placeholder="Nhập nội dung nguy cơ / kiến nghị phát hiện tại nhà trạm..."
                className="w-full font-bold text-slate-800 text-sm bg-transparent border-none focus:outline-none placeholder-amber-700/50"
              />
              <div className="flex flex-wrap items-center text-xs text-amber-800 gap-4">
                <span>Mức ưu tiên: <strong className="font-bold text-amber-900">{priority}</strong></span>
                <span>•</span>
                <span>Đầu mối: <strong className="font-bold text-amber-900">{assignedDept}</strong></span>
              </div>
            </div>

            {/* Action Buttons for Uploading to Drive */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => beforeFileInputRef.current?.click()}
                className="flex-1 py-3 px-4 bg-sky-50 hover:bg-sky-100 active:scale-95 border border-sky-200 text-vnpt-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-4 h-4 text-vnpt-600" />
                <span>+ Tải ảnh hiện trạng ({String(beforePhotos.length).padStart(2, '0')})</span>
              </button>

              <button
                type="button"
                disabled={isUploading}
                onClick={() => afterFileInputRef.current?.click()}
                className="flex-1 py-3 px-4 bg-emerald-50 hover:bg-emerald-100 active:scale-95 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>+ Tải ảnh sau cải thiện ({String(afterPhotos.length).padStart(2, '0')})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPasteType('Trước');
                  setIsPasteModalOpen(true);
                }}
                className="py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                title="Dán liên kết Google Drive trực tiếp"
              >
                <Link2 className="w-4 h-4 text-slate-500" />
                <span>Dán link Drive</span>
              </button>
            </div>

            {/* PHOTO THUMBNAILS GALLERY PREVIEW */}
            <div className="space-y-4 pt-2">
              {/* Before Photos Gallery */}
              {beforePhotos.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-sky-800 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-sky-600" />
                      <span>Ảnh hiện trạng trước khi thực hiện ({beforePhotos.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAllBeforePhotos}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa tất cả</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {beforePhotos.map((url, idx) => {
                      const isBroken = failedImages[url];
                      const isDrive = isDriveOrLh3Url(url);
                      return (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 shadow-xs">
                          {isBroken ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-rose-50/80 border border-rose-200 text-rose-700">
                              <ImageOff className="w-6 h-6 mb-1 text-rose-400" />
                              <span className="text-[10px] font-semibold leading-tight line-clamp-1">Lỗi hiển thị</span>
                              <button
                                type="button"
                                onClick={() => removeBeforePhoto(idx)}
                                className="mt-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                          ) : (
                            <>
                              <img
                                src={toLh3Url(url)}
                                alt={`Ảnh hiện trạng ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onError={() => handleImageError(url)}
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => openBeforeLightbox(idx)}
                              />
                              {/* Drive LH3 Badge */}
                              {isDrive && (
                                <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-slate-900/75 text-[9px] font-bold text-sky-300 rounded-md backdrop-blur-xs">
                                  LH3
                                </span>
                              )}
                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeBeforePhoto(idx);
                                }}
                                title="Xóa ảnh này"
                                className="absolute top-1 right-1 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md z-10 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {/* Bottom Overlay Info */}
                              <div
                                onClick={() => openBeforeLightbox(idx)}
                                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-1.5 flex items-center justify-between text-white text-[10px] cursor-pointer"
                              >
                                <span className="truncate font-medium">Ảnh {idx + 1}</span>
                                <Eye className="w-3.5 h-3.5 opacity-80" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* After Photos Gallery */}
              {afterPhotos.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-emerald-800 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ảnh sau khi hoàn thành 5S ({afterPhotos.length})</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAllAfterPhotos}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xóa tất cả</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {afterPhotos.map((url, idx) => {
                      const isBroken = failedImages[url];
                      const isDrive = isDriveOrLh3Url(url);
                      return (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square bg-slate-100 shadow-xs">
                          {isBroken ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-rose-50/80 border border-rose-200 text-rose-700">
                              <ImageOff className="w-6 h-6 mb-1 text-rose-400" />
                              <span className="text-[10px] font-semibold leading-tight line-clamp-1">Lỗi hiển thị</span>
                              <button
                                type="button"
                                onClick={() => removeAfterPhoto(idx)}
                                className="mt-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold shadow-xs cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                          ) : (
                            <>
                              <img
                                src={toLh3Url(url)}
                                alt={`Ảnh sau cải thiện ${idx + 1}`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                onError={() => handleImageError(url)}
                                className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => openAfterLightbox(idx)}
                              />
                              {/* Drive LH3 Badge */}
                              {isDrive && (
                                <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-slate-900/75 text-[9px] font-bold text-emerald-300 rounded-md backdrop-blur-xs">
                                  LH3
                                </span>
                              )}
                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAfterPhoto(idx);
                                }}
                                title="Xóa ảnh này"
                                className="absolute top-1 right-1 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md z-10 transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                              {/* Bottom Overlay Info */}
                              <div
                                onClick={() => openAfterLightbox(idx)}
                                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-1.5 flex items-center justify-between text-white text-[10px] cursor-pointer"
                              >
                                <span className="truncate font-medium">Ảnh {idx + 1}</span>
                                <Eye className="w-3.5 h-3.5 opacity-80" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Nhật ký cập nhật */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nhật ký cập nhật / Nội dung thực hiện</label>
            <input
              type="text"
              value={executionLog}
              onChange={(e) => setExecutionLog(e.target.value)}
              placeholder="VD: Hoàn thành vệ sinh, phát quang, sắp xếp tủ nguồn và dán nhãn dây cáp..."
              className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-vnpt-500"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Card 1: Kết quả tự động */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Kết quả tự động</h3>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-xs text-slate-400 font-medium">Tổng điểm sau</div>
                <div className="flex items-baseline space-x-1 mt-1">
                  <span className="text-4xl font-black text-vnpt-700">{totalAfter}</span>
                  <span className="text-sm font-bold text-slate-400">/ 100</span>
                </div>
              </div>

              <div className={`px-5 py-2 rounded-full font-black text-xs border tracking-wider shadow-sm ${ratingColor}`}>
                {ratingBadge}
              </div>
            </div>
          </div>

          {/* Card 2: So sánh trước - sau */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">So sánh trước - sau</h3>

            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Trước</span>
                  <span>{totalBefore} đ</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${totalBefore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-vnpt-700 mb-1">
                  <span>Sau</span>
                  <span>{totalAfter} đ</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-vnpt-500 h-full rounded-full shadow-sm" style={{ width: `${totalAfter}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Theo dõi duy trì */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-3">
            <h3 className="font-bold text-slate-800 text-base mb-2">Theo dõi duy trì</h3>

            <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Ngày tái kiểm tra</span>
              <span className="font-bold text-slate-800">27/08/2026</span>
            </div>

            <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Trạng thái kiến nghị</span>
              <span className="font-bold text-amber-600">Đang xử lý</span>
            </div>

            <div className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Ảnh minh chứng Google Drive</span>
              <span className="font-bold text-emerald-600">Chuẩn LH3 ({beforePhotos.length + afterPhotos.length})</span>
            </div>

            <div className="flex justify-between items-center text-xs py-1.5">
              <span className="text-slate-500">Mã QR hồ sơ</span>
              <span className="font-bold text-emerald-600">Đã tạo</span>
            </div>
          </div>

          {/* Card 4: Mobile Phone Frame Preview Widget */}
          <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-2xl space-y-4 border border-slate-800 relative overflow-hidden">
            <div className="w-24 h-4 bg-slate-800 rounded-b-xl mx-auto -mt-5 mb-2" />

            <div
              onClick={() => setIsQrModalOpen(true)}
              className="bg-white rounded-2xl p-4 text-slate-900 text-center space-y-3 cursor-pointer hover:scale-[1.02] transition-transform"
              title="Nhấn để mở xem và tải Mã QR"
            >
              <div className="font-black text-sm text-vnpt-700 uppercase tracking-wide">
                NHÀ TRẠM 5S
              </div>
              <div className="text-xs font-bold text-slate-600">
                {selectedStationCode} • Điểm: {totalAfter}
              </div>

              <div className="flex justify-center py-2">
                <QRCodeSVG
                  value={`https://5s.tt-ht.vnpt.vn/survey/${selectedStationCode}`}
                  size={110}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Chạm để xem phóng to & tải mã QR</div>
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="w-full py-3 bg-vnpt-500 hover:bg-vnpt-600 active:scale-95 text-white rounded-2xl font-extrabold text-xs tracking-wider uppercase shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>CẬP NHẬT TẠI HIỆN TRƯỜNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* FULL-SCREEN IMAGE LIGHTBOX MODAL */}
      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
      />

      {/* PASTE GOOGLE DRIVE LINK MODAL */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100 relative">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-vnpt-500" />
                <span>Thêm liên kết ảnh Google Drive</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Dán bất kỳ link Google Drive nào (link chia sẻ, link xem trước, link tải trực tiếp hoặc file ID). Hệ thống sẽ tự động ghép thành link <strong>LH3 Google CDN</strong> để hiển thị trực tiếp và lưu vào Google Sheet.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Loại ảnh</label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setPasteType('Trước')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      pasteType === 'Trước'
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Ảnh hiện trạng (Trước)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPasteType('Sau')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      pasteType === 'Sau'
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Ảnh sau cải thiện (Sau)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Đường dẫn Google Drive hoặc File ID
                </label>
                <input
                  type="text"
                  value={pastedUrlInput}
                  onChange={(e) => setPastedUrlInput(e.target.value)}
                  placeholder="https://drive.google.com/file/d/1A2B3C4D5E.../view hoặc ID..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500"
                />
              </div>

              {pastedUrlInput.trim() && (
                <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-sky-900">Link LH3 sau khi chuyển đổi:</div>
                  <div className="font-mono text-[11px] text-sky-700 break-all">
                    {toLh3Url(pastedUrlInput.trim())}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddPastedLink}
                disabled={!pastedUrlInput.trim()}
                className="px-5 py-2 bg-vnpt-500 hover:bg-vnpt-600 text-white rounded-xl text-xs font-bold shadow-md transition-colors disabled:opacity-50"
              >
                Thêm vào danh sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE QR CODE MODAL */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 border border-slate-100 text-center relative">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-extrabold text-vnpt-700 uppercase tracking-widest">VNPT TRUNG TÂM HẠ TẦNG</span>
              <h3 className="text-lg font-black text-slate-900 mt-1">MÃ QR HỒ SƠ NHÀ TRẠM</h3>
              <p className="text-xs text-slate-500 mt-0.5">{selectedStationName} ({selectedStationCode})</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block mx-auto shadow-inner">
              <QRCodeSVG
                value={`https://5s.tt-ht.vnpt.vn/survey/${selectedStationCode}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-xs text-blue-900 font-medium">
              Dùng camera điện thoại quét mã QR tại nhà trạm để cập nhật điểm số & chụp ảnh minh chứng tại hiện trường.
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  beforeFileInputRef.current?.click();
                  setIsQrModalOpen(false);
                }}
                className="flex-1 py-2.5 bg-vnpt-500 hover:bg-vnpt-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Chụp ảnh ngay</span>
              </button>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
