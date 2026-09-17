import React, { useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  User,
  Radio,
  Camera,
  CheckCircle2,
  Circle,
  Loader2,
  Building2,
  FileText,
  X
} from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { compressImageFile, readFileAsDataUrl } from '../utils/imageHelper';
import { saveBtsInspectionPhotos, removeBtsInspectionPhoto, updateBtsExpiryStatus, BtsUploadFile } from '../services/api';
import { ImageLightbox, LightboxPhoto } from './ImageLightbox';

const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url) || url.includes('drive.google.com/file') || url.startsWith('data:application/pdf');

interface BtsInspectionViewProps {
  stations: Station[];
  btsInspections: BtsInspection[];
  onUpdated: (updated: BtsInspection) => void;
}

interface EmployeeGroup {
  name: string;
  ma_nv?: string;
  stations: Station[];
}

export const BtsInspectionView: React.FC<BtsInspectionViewProps> = ({ stations, btsInspections, onUpdated }) => {
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [uploadingStationId, setUploadingStationId] = useState<string | null>(null);
  const [removingPhotoKey, setRemovingPhotoKey] = useState<string | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingStationRef = useRef<Station | null>(null);

  // Toàn bộ nhà trạm trong hệ thống đều là trạm viễn thông (BTS/MACRO/REMOTE_SECTOR...)
  // nên áp dụng công bố kiểm định cho tất cả, không lọc riêng theo loai_nha_tram
  const btsStations = stations;

  const orgGroups = useMemo(() => {
    const map = new Map<string, Station[]>();
    btsStations.forEach(s => {
      const key = s.to_ha_tang || 'Chưa phân tổ';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [btsStations]);

  const getEmployeeGroups = (orgStations: Station[]): EmployeeGroup[] => {
    const map = new Map<string, EmployeeGroup>();
    orgStations.forEach(s => {
      const key = s.nguoi_phu_trach || 'Chưa phân công';
      if (!map.has(key)) map.set(key, { name: key, ma_nv: s.ma_nv, stations: [] });
      map.get(key)!.stations.push(s);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  };

  // Tra cứu O(1) theo id_nha_tram thay vì Array.find() O(n) lặp lại cho từng trạm trên mỗi lần
  // render - với ~1900 trạm, .find() lặp lại hàng ngàn lần mỗi khi có 1 ảnh cập nhật sẽ làm
  // giao diện bị khựng/chậm hiển thị dù state đã cập nhật tức thời.
  const inspectionByStation = useMemo(() => {
    const map = new Map<string, BtsInspection>();
    btsInspections.forEach(b => map.set(b.id_nha_tram, b));
    return map;
  }, [btsInspections]);

  const getInspection = (idNhaTram: string): BtsInspection | undefined => inspectionByStation.get(idNhaTram);

  const handleOpenPicker = (station: Station, useCamera: boolean) => {
    pendingStationRef.current = station;
    const input = useCamera ? cameraInputRef.current : fileInputRef.current;
    input?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const station = pendingStationRef.current;
    const files = e.target.files;
    if (!station || !files || files.length === 0) return;
    pendingStationRef.current = null;
    const inputEl = e.target;
    const fileList = Array.from(files);
    inputEl.value = '';

    // Hiện ảnh/PDF NGAY LẬP TỨC bằng blob URL của chính file vừa chọn (tạo tức thời, không
    // cần đọc/nén gì cả) - trước khi làm bất kỳ việc nặng nào (nén ảnh, tải lên Drive).
    // Việc nén + tải lên chạy ngầm phía sau và tự thay bằng link thật khi xong.
    const previewUrls = fileList.map(file => {
      const blobUrl = URL.createObjectURL(file);
      return file.type === 'application/pdf' ? blobUrl + '#.pdf' : blobUrl;
    });

    const existing = getInspection(station.id_nha_tram);
    const optimisticPhotos = [...(existing?.anh_niem_yet_list || []), ...previewUrls];
    onUpdated({
      id_kiem_dinh: existing?.id_kiem_dinh || 'BTS' + station.id_nha_tram,
      id_nha_tram: station.id_nha_tram,
      ma_nha_tram: station.ma_nha_tram,
      ten_nha_tram: station.ten_nha_tram,
      to_ha_tang: station.to_ha_tang,
      nguoi_phu_trach: station.nguoi_phu_trach,
      ma_nv: station.ma_nv,
      trang_thai: 'Đã dán',
      anh_niem_yet_list: optimisticPhotos,
      ngay_dan: existing?.ngay_dan || new Date().toLocaleDateString('vi-VN'),
      nguoi_tai: existing?.nguoi_tai || station.nguoi_phu_trach || 'Không xác định',
      thoi_diem_cap_nhat: new Date().toLocaleString('vi-VN'),
      han_kiem_dinh: existing?.han_kiem_dinh
    });

    setUploadingStationId(station.id_nha_tram);
    (async () => {
      try {
        const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').trim();
        const namePrefix = `${sanitize(station.to_ha_tang || '')}_${sanitize(station.nguoi_phu_trach || '')}`.replace(/\s+/g, '');

        // Nén/đọc song song tất cả file cùng lúc thay vì tuần tự để rút ngắn thời gian chờ
        const uploadFiles: BtsUploadFile[] = await Promise.all(
          fileList.map(async (file, i) => {
            const isPdf = file.type === 'application/pdf';
            // Ảnh niêm yết chỉ cần đủ rõ để đọc chữ -> nén nhỏ + nhanh hơn ảnh minh chứng 5S thông thường
            const dataUrl = isPdf ? await readFileAsDataUrl(file) : await compressImageFile(file, 1280, 1280, 0.72);
            return {
              dataUrl,
              mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
              fileName: isPdf
                ? `${namePrefix}_${sanitize(file.name || `${station.ma_nha_tram}_${Date.now()}_${i + 1}.pdf`)}`
                : `${namePrefix}_${station.ma_nha_tram}_${Date.now()}_${i + 1}.jpg`,
              isPdf
            };
          })
        );

        const updated = await saveBtsInspectionPhotos({
          id_nha_tram: station.id_nha_tram,
          ma_nha_tram: station.ma_nha_tram,
          ten_nha_tram: station.ten_nha_tram,
          to_ha_tang: station.to_ha_tang,
          nguoi_phu_trach: station.nguoi_phu_trach,
          ma_nv: station.ma_nv,
          nguoi_tai: station.nguoi_phu_trach || 'Không xác định',
          photoFiles: uploadFiles
        });

        // Thay ảnh tạm (blob URL) bằng link Drive thật sau khi tải lên xong
        onUpdated(updated);
      } catch (err) {
        console.error('Lỗi tải ảnh niêm yết BTS:', err);
      } finally {
        setUploadingStationId(null);
        previewUrls.forEach(u => URL.revokeObjectURL(u.replace(/#\.pdf$/, '')));
      }
    })();
  };

  const handleToggleExpiry = (station: Station, current?: string) => {
    const next: 'Còn hạn' | 'Hết hạn' | '' =
      current === 'Còn hạn' ? 'Hết hạn' : current === 'Hết hạn' ? '' : 'Còn hạn';

    const existing = getInspection(station.id_nha_tram);

    // Cập nhật giao diện ngay lập tức (optimistic) thay vì chờ round-trip mạng
    // rồi mới đổi màu nút - request thật gửi ngầm phía sau, không chặn thao tác tiếp theo.
    const optimistic: BtsInspection = {
      id_kiem_dinh: existing?.id_kiem_dinh || 'BTS' + station.id_nha_tram,
      id_nha_tram: station.id_nha_tram,
      ma_nha_tram: station.ma_nha_tram,
      ten_nha_tram: station.ten_nha_tram,
      to_ha_tang: station.to_ha_tang,
      nguoi_phu_trach: station.nguoi_phu_trach,
      ma_nv: station.ma_nv,
      trang_thai: existing?.trang_thai || 'Chưa dán',
      anh_niem_yet_list: existing?.anh_niem_yet_list || [],
      ngay_dan: existing?.ngay_dan,
      nguoi_tai: existing?.nguoi_tai,
      thoi_diem_cap_nhat: new Date().toLocaleString('vi-VN'),
      han_kiem_dinh: next
    };
    onUpdated(optimistic);

    updateBtsExpiryStatus({
      id_nha_tram: station.id_nha_tram,
      ma_nha_tram: station.ma_nha_tram,
      ten_nha_tram: station.ten_nha_tram,
      to_ha_tang: station.to_ha_tang,
      nguoi_phu_trach: station.nguoi_phu_trach,
      ma_nv: station.ma_nv,
      han_kiem_dinh: next
    }).catch(err => console.error('Lỗi cập nhật hạn kiểm định:', err));
  };

  const handleRemovePhoto = async (station: Station, inspection: BtsInspection, photoUrl: string) => {
    const key = `${station.id_nha_tram}__${photoUrl}`;
    setRemovingPhotoKey(key);
    try {
      const updated = await removeBtsInspectionPhoto(inspection, photoUrl);
      onUpdated(updated);
    } catch (err) {
      console.error('Lỗi xóa ảnh niêm yết:', err);
    } finally {
      setRemovingPhotoKey(null);
    }
  };

  const openLightbox = (station: Station, photos: string[], startIndex: number) => {
    const imageOnly = photos.filter(url => !isPdfUrl(url));
    setLightboxPhotos(
      imageOnly.map((url, idx) => ({
        url,
        title: `Niêm yết kiểm định #${idx + 1}`,
        stationCode: station.ma_nha_tram,
        type: 'Minh chứng' as const
      }))
    );
    setLightboxIndex(Math.max(0, imageOnly.indexOf(photos[startIndex])));
    setIsLightboxOpen(true);
  };

  return (
    <div className="space-y-6">
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFilesSelected} />
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFilesSelected} />

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-vnpt-600" />
          <span>Công bố kiểm định BTS</span>
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Chọn Tổ Hạ tầng → nhân viên quản lý → chụp hoặc tải ảnh/file PDF giấy niêm yết kiểm định đã dán tại từng trạm BTS
        </p>
      </div>

      <div className="space-y-3">
        {orgGroups.map(([orgName, orgStations]) => {
          const isOrgOpen = expandedOrg === orgName;
          // Chỉ nhóm theo nhân viên khi tổ đang mở - không cần tính cho 8 tổ còn lại đang đóng
          const employees = isOrgOpen ? getEmployeeGroups(orgStations) : [];
          const totalPosted = orgStations.filter(s => inspectionByStation.get(s.id_nha_tram)?.trang_thai === 'Đã dán').length;

          return (
            <div key={orgName} className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedOrg(isOrgOpen ? null : orgName)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-vnpt-600" />
                  <span className="font-bold text-slate-800 text-sm">{orgName}</span>
                  <span className="text-xs font-semibold text-slate-400">({orgStations.length} trạm BTS)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {totalPosted}/{orgStations.length} đã dán niêm yết
                  </span>
                  {isOrgOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </div>
              </button>

              {isOrgOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {employees.map(emp => {
                    const empKey = `${orgName}__${emp.name}`;
                    const isEmpOpen = expandedEmployee === empKey;
                    const empPosted = emp.stations.filter(s => getInspection(s.id_nha_tram)?.trang_thai === 'Đã dán').length;

                    return (
                      <div key={empKey}>
                        <button
                          type="button"
                          onClick={() => setExpandedEmployee(isEmpOpen ? null : empKey)}
                          className="w-full flex items-center justify-between px-5 py-3 pl-8 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-semibold text-slate-700 text-sm">{emp.name}</span>
                            {emp.ma_nv && <span className="text-[11px] text-slate-400 font-medium">({emp.ma_nv})</span>}
                            <span className="text-[11px] font-semibold text-slate-400">• {emp.stations.length} trạm</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                              empPosted === emp.stations.length
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {empPosted}/{emp.stations.length}
                            </span>
                            {isEmpOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                        </button>

                        {isEmpOpen && (
                          <div className="bg-slate-50/60 px-5 pl-11 py-3 space-y-2.5">
                            {emp.stations.map(station => {
                              const inspection = getInspection(station.id_nha_tram);
                              const isPosted = inspection?.trang_thai === 'Đã dán';
                              const photos = inspection?.anh_niem_yet_list || [];
                              const isUploading = uploadingStationId === station.id_nha_tram;
                              const hanKiemDinh = inspection?.han_kiem_dinh || '';

                              return (
                                <div
                                  key={station.id_nha_tram}
                                  className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                      <Radio className="w-4 h-4 text-vnpt-500 mt-0.5 shrink-0" />
                                      <div className="min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{station.ten_nha_tram}</div>
                                        <div className="text-xs text-slate-500 font-medium">{station.ma_nha_tram} • {station.dia_ban}</div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {isPosted ? (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          Đã dán niêm yết
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-full">
                                          <Circle className="w-3.5 h-3.5" />
                                          Chưa dán
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleToggleExpiry(station, hanKiemDinh)}
                                        className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border transition-all cursor-pointer active:scale-95 ${
                                          hanKiemDinh === 'Còn hạn'
                                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                                            : hanKiemDinh === 'Hết hạn'
                                            ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                            : 'bg-transparent text-slate-300 border-slate-200'
                                        }`}
                                        title="Bấm để chuyển trạng thái: Còn hạn / Hết hạn / Chưa xác định"
                                      >
                                        {hanKiemDinh === 'Còn hạn' ? (
                                          <CheckCircle2 className="w-3 h-3" />
                                        ) : hanKiemDinh === 'Hết hạn' ? (
                                          <Circle className="w-3 h-3" />
                                        ) : null}
                                        {hanKiemDinh || 'Hạn kiểm định'}
                                      </button>

                                      {isUploading ? (
                                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-vnpt-600 px-2.5 py-1.5">
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          Đang tải...
                                        </span>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenPicker(station, true)}
                                            className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-vnpt-500 hover:bg-vnpt-600 active:scale-95 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                            title="Chụp ảnh từ điện thoại"
                                          >
                                            <Camera className="w-3.5 h-3.5" />
                                            Chụp ảnh
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenPicker(station, false)}
                                            className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                                            title="Chọn ảnh hoặc file PDF từ máy tính"
                                          >
                                            Chọn file
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {photos.length > 0 && (
                                    <div className="flex flex-wrap gap-3 pl-6.5">
                                      {photos.map((url, idx) => {
                                        const removeKey = `${station.id_nha_tram}__${url}`;
                                        const isRemoving = removingPhotoKey === removeKey;
                                        return (
                                          <div key={idx} className="relative shrink-0 w-16 h-16">
                                            {isPdfUrl(url) ? (
                                              <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-16 h-16 rounded-lg border border-rose-200 bg-rose-50 flex flex-col items-center justify-center gap-0.5 hover:bg-rose-100 transition-colors"
                                                title="Mở file PDF niêm yết"
                                              >
                                                <FileText className="w-5 h-5 text-rose-500" />
                                                <span className="text-[9px] font-bold text-rose-600">PDF</span>
                                              </a>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => openLightbox(station, photos, idx)}
                                                className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden hover:ring-2 hover:ring-vnpt-400 transition-all cursor-pointer"
                                                title="Xem ảnh niêm yết"
                                              >
                                                <img src={url} alt="Ảnh niêm yết kiểm định" className="w-full h-full object-cover" />
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              disabled={isRemoving}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (inspection) handleRemovePhoto(station, inspection, url);
                                              }}
                                              className="absolute top-0.5 right-0.5 z-10 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-rose-600 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                                              title="Xóa để thay file khác"
                                            >
                                              {isRemoving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {orgGroups.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center text-sm text-slate-400 font-semibold border border-slate-200/80">
            Chưa có trạm BTS nào trong danh mục nhà trạm.
          </div>
        )}
      </div>

      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
      />
    </div>
  );
};
