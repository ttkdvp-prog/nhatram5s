import React, { useState } from 'react';
import { Recommendation } from '../types';
import { AlertTriangle, Clock, CheckCircle2, ShieldAlert, Eye, Image, X } from 'lucide-react';
import { toLh3Url, parseSheetPhotoUrls } from '../utils/imageHelper';

interface RecommendationsViewProps {
  recommendations: Recommendation[];
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({ recommendations }) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Quản lý Kiến nghị & Nguy cơ phát hiện</h2>
        <p className="text-xs text-slate-500 mt-1">Theo dõi các nguy cơ an toàn lao động, PCCC và đề xuất cải thiện tại các nhà trạm</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec) => {
          return (
            <div key={rec.id_kien_nghi} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
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

      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden p-4 border border-slate-800 shadow-2xl flex flex-col items-center space-y-3">
            <div className="w-full flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-sky-400 bg-sky-950/60 border border-sky-800 px-2.5 py-1 rounded-lg">
                Link LH3 Google CDN
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full flex items-center justify-center p-2">
              <img
                src={toLh3Url(previewImage)}
                alt="Xem ảnh phóng to"
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-2xl"
              />
            </div>

            <div className="w-full bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 break-all select-all">
              {toLh3Url(previewImage)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
