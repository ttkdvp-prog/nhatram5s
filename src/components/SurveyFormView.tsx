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
  Check
} from 'lucide-react';
import { toLh3Url, extractDriveFileId, isDriveOrLh3Url } from '../utils/imageHelper';
import { uploadImageToGoogleDrive } from '../services/api';
import { ImageLightbox, LightboxPhoto } from './ImageLightbox';

interface SurveyFormViewProps {
  stations: Station[];
  onSave: (record: Partial<SurveyRecord>) => void;
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
    before: [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=500&auto=format&fit=crop&q=80'
    ],
    after: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1581091215367-9b6c00b3035a?w=500&auto=format&fit=crop&q=80'
    ]
  };
};

export const SurveyFormView: React.FC<SurveyFormViewProps> = ({
  stations,
  onSave,
  initialRecord
}) => {
  // Form State
  const [selectedStationCode, setSelectedStationCode] = useState(initialRecord?.ma_nha_tram || 'TPO-0215');
  const [selectedStationName, setSelectedStationName] = useState(initialRecord?.ten_nha_tram || 'BTS Trung tâm Việt Trì');
  const [toHaTang, setToHaTang] = useState(initialRecord?.to_ha_tang || 'Việt Trì');
  const [surveyDate, setSurveyDate] = useState(initialRecord?.ngay_khao_sat || '27/07/2026');
  const [surveyor, setSurveyor] = useState(initialRecord?.nguoi_khao_sat || 'Nguyễn Văn A');

  // 5S Score Inputs
  const [s1Before, setS1Before] = useState(initialRecord?.s1_truoc || 12);
  const [s2Before, setS2Before] = useState(initialRecord?.s2_truoc || 13);
  const [s3Before, setS3Before] = useState(initialRecord?.s3_truoc || 18);
  const [s4Before, setS4Before] = useState(initialRecord?.s4_truoc || 14);
  const [s5Before, setS5Before] = useState(initialRecord?.s5_truoc || 11);

  const [s1After, setS1After] = useState(initialRecord?.s1_sau || 17);
  const [s2After, setS2After] = useState(initialRecord?.s2_sau || 18);
  const [s3After, setS3After] = useState(initialRecord?.s3_sau || 22);
  const [s4After, setS4After] = useState(initialRecord?.s4_sau || 16);
  const [s5After, setS5After] = useState(initialRecord?.s5_sau || 14);

  // Risk and recommendations
  const [riskContent, setRiskContent] = useState(initialRecord?.noi_dung_kien_nghi || 'Thực bì, lá khô gần khu vực máy phát điện');
  const [priority, setPriority] = useState(initialRecord?.muc_uu_tien || 'Cao');
  const [assignedDept, setAssignedDept] = useState('Bộ phận chuyên môn');
  const [executionLog, setExecutionLog] = useState(initialRecord?.noi_dung_thuc_hien || 'Hoàn thành vệ sinh, phát quang và chấm điểm sau');

  // Photo state with LH3 URLs
  const initialPhotos = getStoredPhotos(initialRecord?.ma_nha_tram || 'TPO-0215');
  const [beforePhotos, setBeforePhotos] = useState<string[]>(
    (initialRecord?.anh_truoc_list || initialPhotos.before).map(toLh3Url)
  );
  const [afterPhotos, setAfterPhotos] = useState<string[]>(
    (initialRecord?.anh_sau_list || initialPhotos.after).map(toLh3Url)
  );

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  // Paste Drive Link Modal state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteType, setPasteType] = useState<'Trước' | 'Sau'>('Trước');
  const [pastedUrlInput, setPastedUrlInput] = useState('');

  // Sync photos to localStorage on state changes
  useEffect(() => {
    localStorage.setItem(
      `nhatram5s_photos_${selectedStationCode}`,
      JSON.stringify({ beforePhotos, afterPhotos })
    );
  }, [beforePhotos, afterPhotos, selectedStationCode]);

  // Track failed image URLs
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const handleImageError = (url: string) => {
    setFailedImages(prev => ({ ...prev, [url]: true }));
  };

  // File input refs for uploading
  const beforeFileInputRef = useRef<HTMLInputElement | null>(null);
  const afterFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState(false);
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

  const handleStationChange = (code: string) => {
    setSelectedStationCode(code);
    const found = stations.find(s => s.ma_nha_tram === code);
    if (found) {
      setSelectedStationName(found.ten_nha_tram);
      setToHaTang(found.to_ha_tang.replace('Tổ Hạ tầng ', ''));
    }
    const stored = getStoredPhotos(code);
    setBeforePhotos(stored.before.map(toLh3Url));
    setAfterPhotos(stored.after.map(toLh3Url));
  };

  // Process File Upload to Google Drive and convert to LH3 Link
  const processUpload = async (files: FileList | null, photoType: 'Trước' | 'Sau') => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const totalFiles = files.length;
    let completed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadStatusMsg(`Đang tải ảnh ${i + 1}/${totalFiles} lên Google Drive & tạo link LH3...`);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadResult = await uploadImageToGoogleDrive({
          base64Data: base64,
          fileName: `5S_${selectedStationCode}_${photoType}_${Date.now()}_${i + 1}.jpg`,
          mimeType: file.type || 'image/jpeg',
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

  const removePhotoByUrl = (urlToRemove: string) => {
    setBeforePhotos(prev => prev.filter(url => url !== urlToRemove));
    setAfterPhotos(prev => prev.filter(url => url !== urlToRemove));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanBefore = beforePhotos.map(toLh3Url);
    const cleanAfter = afterPhotos.map(toLh3Url);

    onSave({
      ma_nha_tram: selectedStationCode,
      ten_nha_tram: selectedStationName,
      to_ha_tang: `Tổ Hạ tầng ${toHaTang}`,
      ngay_khao_sat: surveyDate,
      nguoi_khao_sat: surveyor,
      s1_truoc: s1Before,
      s2_truoc: s2Before,
      s3_truoc: s3Before,
      s4_truoc: s4Before,
      s5_truoc: s5Before,
      s1_sau: s1After,
      s2_sau: s2After,
      s3_sau: s3After,
      s4_sau: s4After,
      s5_sau: s5After,
      noi_dung_kien_nghi: riskContent,
      muc_uu_tien: priority,
      noi_dung_thuc_hien: executionLog,
      anh_truoc_url: cleanBefore[0] || '',
      anh_sau_url: cleanAfter[0] || '',
      anh_truoc_list: cleanBefore,
      anh_sau_list: cleanAfter
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Phiếu khảo sát và đánh giá Nhà trạm 5S
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tự động lưu ảnh vào Google Drive, ghép link chuẩn LH3 và đồng bộ thời gian thực lên Google Sheets
          </p>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="px-6 py-3 bg-vnpt-500 hover:bg-vnpt-600 active:scale-95 text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-vnpt-500/25 transition-all flex items-center justify-center gap-2 self-start md:self-auto disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>LƯU PHIẾU VÀ ĐỒNG BỘ</span>
        </button>
      </div>

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
          <span>Lưu phiếu khảo sát 5S và đồng bộ link LH3 thành công!</span>
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
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mã nhà trạm</label>
                <select
                  value={selectedStationCode}
                  onChange={(e) => handleStationChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500 text-sm"
                >
                  {stations.map((s) => (
                    <option key={s.id_nha_tram} value={s.ma_nha_tram}>
                      {s.ma_nha_tram} - {s.ten_nha_tram}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tên nhà trạm</label>
                <input
                  type="text"
                  value={selectedStationName}
                  onChange={(e) => setSelectedStationName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-vnpt-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tổ Hạ tầng</label>
                <input
                  type="text"
                  value={toHaTang}
                  onChange={(e) => setToHaTang(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-vnpt-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ngày khảo sát</label>
                <input
                  type="text"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-vnpt-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Chấm điểm 5S */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>Chấm điểm 5S</span>
              </h3>
              <span className="text-xs font-bold text-vnpt-600 bg-vnpt-50 px-2.5 py-1 rounded-lg">
                Tổng điểm sau: {totalAfter} / 100
              </span>
            </div>

            {/* 5 Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {/* S1 */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-center flex flex-col items-center justify-between space-y-2">
                <div className="w-8 h-8 rounded-full bg-vnpt-500 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  S1
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Sàng lọc</div>
                <div className="w-full">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s1After}
                    onChange={(e) => setS1After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-lg bg-white border border-slate-300 rounded-xl py-1 focus:ring-2 focus:ring-vnpt-500"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">/20 điểm</div>
                </div>
              </div>

              {/* S2 */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-center flex flex-col items-center justify-between space-y-2">
                <div className="w-8 h-8 rounded-full bg-vnpt-500 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  S2
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Sắp xếp</div>
                <div className="w-full">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s2After}
                    onChange={(e) => setS2After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-lg bg-white border border-slate-300 rounded-xl py-1 focus:ring-2 focus:ring-vnpt-500"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">/20 điểm</div>
                </div>
              </div>

              {/* S3 */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-center flex flex-col items-center justify-between space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  S3
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Sạch sẽ</div>
                <div className="w-full">
                  <input
                    type="number"
                    min={0}
                    max={25}
                    value={s3After}
                    onChange={(e) => setS3After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-lg bg-white border border-slate-300 rounded-xl py-1 focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">/25 điểm</div>
                </div>
              </div>

              {/* S4 */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-center flex flex-col items-center justify-between space-y-2">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  S4
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Săn sóc</div>
                <div className="w-full">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={s4After}
                    onChange={(e) => setS4After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-lg bg-white border border-slate-300 rounded-xl py-1 focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">/20 điểm</div>
                </div>
              </div>

              {/* S5 */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-center flex flex-col items-center justify-between space-y-2">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shadow-md">
                  S5
                </div>
                <div className="text-[11px] font-semibold text-slate-500">Sẵn sàng</div>
                <div className="w-full">
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={s5After}
                    onChange={(e) => setS5After(Number(e.target.value))}
                    className="w-full text-center font-black text-slate-800 text-lg bg-white border border-slate-300 rounded-xl py-1 focus:ring-2 focus:ring-emerald-600"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">/15 điểm</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Nguy cơ/kiến nghị & ĐÍNH KÈM ẢNH GOOGLE DRIVE */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Nguy cơ/kiến nghị phát hiện</span>
            </h3>

            {/* Alert banner */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 space-y-2">
              <input
                type="text"
                value={riskContent}
                onChange={(e) => setRiskContent(e.target.value)}
                placeholder="Nhập nội dung nguy cơ / kiến nghị..."
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
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nhật ký cập nhật</label>
            <input
              type="text"
              value={executionLog}
              onChange={(e) => setExecutionLog(e.target.value)}
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
                  <span>{totalBefore}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-slate-400 h-full rounded-full" style={{ width: `${totalBefore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-vnpt-700 mb-1">
                  <span>Sau</span>
                  <span>{totalAfter}</span>
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
