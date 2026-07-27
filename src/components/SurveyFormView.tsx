import React, { useState } from 'react';
import { Station, SurveyRecord } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Save, Camera, CheckCircle, AlertTriangle, Calendar, Building2, UserCheck, ShieldCheck, Sparkles, Upload } from 'lucide-react';

interface SurveyFormViewProps {
  stations: Station[];
  onSave: (record: Partial<SurveyRecord>) => void;
  initialRecord?: SurveyRecord | null;
}

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

  // 5S Score Inputs matching Image 1
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

  // Photo counts matching Image 1
  const [photoBeforeCount, setPhotoBeforeCount] = useState(3);
  const [photoAfterCount, setPhotoAfterCount] = useState(4);

  // Notifications
  const [savedSuccess, setSavedSuccess] = useState(false);

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
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      noi_dung_thuc_hien: executionLog
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Form Header matching Image 1 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Phiếu khảo sát và đánh giá Nhà trạm 5S
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cập nhật hiện trạng, điểm số, ảnh minh chứng và kiến nghị tại một biểu mẫu thống nhất
          </p>
        </div>

        <button
          type="submit"
          className="px-6 py-3 bg-vnpt-500 hover:bg-vnpt-600 active:scale-95 text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-vnpt-500/25 transition-all flex items-center justify-center gap-2 self-start md:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>LƯU PHIẾU</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl p-4 flex items-center space-x-3 text-sm font-bold animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span>Lưu phiếu khảo sát thành công! Dữ liệu đã được cập nhật.</span>
        </div>
      )}

      {/* Main Layout Grid matching Image 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols wide) matching Image 1 */}
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

          {/* Section 2: Chấm điểm 5S (5 Cards) matching Image 1 */}
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

            {/* 5 Cards Row matching Image 1 */}
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

          {/* Section 3: Nguy cơ/kiến nghị phát hiện matching Image 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Nguy cơ/kiến nghị phát hiện</span>
            </h3>

            {/* Alert banner matching Image 1 */}
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

            {/* Action Buttons matching Image 1 */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPhotoBeforeCount(prev => prev + 1)}
                className="flex-1 py-3 px-4 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-vnpt-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4 text-vnpt-600" />
                <span>+ Ảnh hiện trạng ({String(photoBeforeCount).padStart(2, '0')})</span>
              </button>

              <button
                type="button"
                onClick={() => setPhotoAfterCount(prev => prev + 1)}
                className="flex-1 py-3 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>+ Ảnh sau cải thiện ({String(photoAfterCount).padStart(2, '0')})</span>
              </button>
            </div>
          </div>

          {/* Nhật ký cập nhật matching Image 1 */}
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

        {/* Right Column (Results & Mobile Frame) matching Image 1 */}
        <div className="space-y-6">
          {/* Card 1: Kết quả tự động matching Image 1 */}
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

              {/* Status Badge pill matching Image 1 */}
              <div className={`px-5 py-2 rounded-full font-black text-xs border tracking-wider shadow-sm ${ratingColor}`}>
                {ratingBadge}
              </div>
            </div>
          </div>

          {/* Card 2: So sánh trước - sau matching Image 1 */}
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

          {/* Card 3: Theo dõi duy trì matching Image 1 */}
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
              <span className="text-slate-500">Ảnh minh chứng</span>
              <span className="font-bold text-emerald-600">Đã đủ</span>
            </div>

            <div className="flex justify-between items-center text-xs py-1.5">
              <span className="text-slate-500">Mã QR hồ sơ</span>
              <span className="font-bold text-emerald-600">Đã tạo</span>
            </div>
          </div>

          {/* Card 4: Mobile Phone Frame Preview Widget matching Image 1 */}
          <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-2xl space-y-4 border border-slate-800 relative overflow-hidden">
            {/* Phone Top Notch */}
            <div className="w-24 h-4 bg-slate-800 rounded-b-xl mx-auto -mt-5 mb-2" />

            <div className="bg-white rounded-2xl p-4 text-slate-900 text-center space-y-3">
              <div className="font-black text-sm text-vnpt-700 uppercase tracking-wide">
                NHÀ TRẠM 5S
              </div>
              <div className="text-xs font-bold text-slate-600">
                {selectedStationCode} • Điểm: {totalAfter}
              </div>

              {/* QR Code */}
              <div className="flex justify-center py-2">
                <QRCodeSVG
                  value={`https://5s.tt-ht.vnpt.vn/survey/${selectedStationCode}`}
                  size={100}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>

            <button
              type="button"
              className="w-full py-3 bg-vnpt-500 hover:bg-vnpt-600 active:scale-95 text-white rounded-2xl font-extrabold text-xs tracking-wider uppercase shadow-lg transition-all"
            >
              CẬP NHẬT TẠI HIỆN TRƯỜNG
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
