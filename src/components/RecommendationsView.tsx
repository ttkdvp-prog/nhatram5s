import React from 'react';
import { Recommendation } from '../types';
import { ShieldAlert, Image } from 'lucide-react';
import { parseSheetPhotoUrls } from '../utils/imageHelper';
import { PhotoThumbnail } from './PhotoThumbnail';

interface RecommendationsViewProps {
  recommendations: Recommendation[];
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({ recommendations }) => {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Quản lý Kiến nghị & Nguy cơ phát hiện</h2>
        <p className="text-xs text-slate-500 mt-1">Theo dõi các nguy cơ an toàn lao động, PCCC và đề xuất cải thiện tại các nhà trạm kèm ảnh minh chứng LH3</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec) => {
          const recPhotos = parseSheetPhotoUrls([rec.anh_truoc_url, rec.anh_sau_url].filter(Boolean) as string[]);

          return (
            <div key={rec.id_kien_nghi} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-vnpt-700">{rec.ma_nha_tram}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    rec.muc_uu_tien === 'Khẩn cấp' ? 'bg-rose-100 text-rose-800' :
                    rec.muc_uu_tien === 'Cao' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {rec.muc_uu_tien}
                  </span>
                </div>

                <h4 className="font-bold text-slate-800 text-sm">{rec.loai_nguy_co}</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">{rec.noi_dung_kien_nghi}</p>

                {/* Evidence Photos in Recommendation */}
                {recPhotos.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                      <Image className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ảnh hiện trường:</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {recPhotos.map((url, idx) => (
                        <PhotoThumbnail
                          key={idx}
                          url={url}
                          type="Nguy cơ"
                          title={`Nguy cơ: ${rec.loai_nguy_co} - ${rec.ma_nha_tram}`}
                          stationCode={rec.ma_nha_tram}
                          className="w-full aspect-square rounded-xl"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Hạn xử lý: <strong className="text-slate-800">{rec.han_xu_ly}</strong></span>
                <span className={`font-bold ${rec.trang_thai === 'Hoàn thành' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {rec.trang_thai}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
