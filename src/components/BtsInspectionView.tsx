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
  FileText
} from 'lucide-react';
import { Station, BtsInspection } from '../types';
import { compressImageFile, readFileAsDataUrl } from '../utils/imageHelper';
import { saveBtsInspectionPhotos, BtsUploadFile } from '../services/api';
import { ImageLightbox, LightboxPhoto } from './ImageLightbox';

const isPdfUrl = (url: string) => /\.pdf(\?|$)/i.test(url) || url.includes('drive.google.com/file');

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

  const getInspection = (idNhaTram: string): BtsInspection | undefined =>
    btsInspections.find(b => b.id_nha_tram === idNhaTram);

  const handleOpenPicker = (station: Station, useCamera: boolean) => {
    pendingStationRef.current = station;
    const input = useCamera ? cameraInputRef.current : fileInputRef.current;
    input?.click();
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const station = pendingStationRef.current;
    const files = e.target.files;
    if (!station || !files || files.length === 0) return;

    setUploadingStationId(station.id_nha_tram);
    try {
      const uploadFiles: BtsUploadFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === 'application/pdf';
        const dataUrl = isPdf ? await readFileAsDataUrl(file) : await compressImageFile(file);
        uploadFiles.push({
          dataUrl,
          mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
          fileName: isPdf
            ? (file.name || `BTS_NiemYet_${station.ma_nha_tram}_${Date.now()}_${i + 1}.pdf`)
            : `BTS_NiemYet_${station.ma_nha_tram}_${Date.now()}_${i + 1}.jpg`,
          isPdf
        });
      }

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

      onUpdated(updated);
    } catch (err) {
      console.error('Lỗi tải ảnh niêm yết BTS:', err);
    } finally {
      setUploadingStationId(null);
      pendingStationRef.current = null;
      e.target.value = '';
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
          Chọn Tổ Hạ tầng → nhân viên quản lý → chụp hoặc tải ảnh/file PDF giấy niêm yết kiểm định đã dán tại từng trạm BTS.
          File được lưu trên Google Drive và hiển thị công khai cho mọi người xem.
        </p>
      </div>

      <div className="space-y-3">
        {orgGroups.map(([orgName, orgStations]) => {
          const isOrgOpen = expandedOrg === orgName;
          const employees = getEmployeeGroups(orgStations);
          const totalPosted = orgStations.filter(s => getInspection(s.id_nha_tram)?.trang_thai === 'Đã dán').length;

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
                                    <div className="flex flex-wrap gap-2 pl-6.5">
                                      {photos.map((url, idx) =>
                                        isPdfUrl(url) ? (
                                          <a
                                            key={idx}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-14 h-14 rounded-lg border border-rose-200 bg-rose-50 flex flex-col items-center justify-center gap-0.5 hover:bg-rose-100 transition-colors shrink-0"
                                            title="Mở file PDF niêm yết"
                                          >
                                            <FileText className="w-5 h-5 text-rose-500" />
                                            <span className="text-[9px] font-bold text-rose-600">PDF</span>
                                          </a>
                                        ) : (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => openLightbox(station, photos, idx)}
                                            className="w-14 h-14 rounded-lg border border-slate-200 overflow-hidden shrink-0 hover:ring-2 hover:ring-vnpt-400 transition-all cursor-pointer"
                                            title="Xem ảnh niêm yết"
                                          >
                                            <img src={url} alt="Ảnh niêm yết kiểm định" className="w-full h-full object-cover" />
                                          </button>
                                        )
                                      )}
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
