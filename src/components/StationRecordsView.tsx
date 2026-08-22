import React, { useState } from 'react';
import { Station, SurveyRecord } from '../types';
import * as XLSX from 'xlsx';
import { Search, Download, Filter, Eye, Building2, Calendar, CheckCircle2, AlertTriangle, Camera, Upload, X, Copy, ExternalLink, Image } from 'lucide-react';
import { toLh3Url, parseSheetPhotoUrls, extractDriveFileId } from '../utils/imageHelper';

interface StationRecordsViewProps {
  stations: Station[];
  records: SurveyRecord[];
}

export const StationRecordsView: React.FC<StationRecordsViewProps> = ({ stations, records }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('Tất cả');
  const [selectedDetail, setSelectedDetail] = useState<SurveyRecord | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const filteredRecords = records.filter((rec) => {
    const matchesSearch =
      rec.ma_nha_tram.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.ten_nha_tram.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.to_ha_tang.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOrg = selectedOrg === 'Tất cả' || rec.to_ha_tang.includes(selectedOrg);
    return matchesSearch && matchesOrg;
  });

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'HoSo5S');
    XLSX.writeFile(workbook, `Danh_Sach_Ho_So_5S_Nha_Tram_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const availableOrgs = Array.from(new Set([
    'Tổ Hạ tầng Việt Trì', 'Tổ Hạ tầng Vĩnh Yên', 'Tổ Hạ tầng Hòa Bình', 'Tổ Hạ tầng Lương Sơn', 'Tổ Hạ tầng Thanh Ba', 'Tổ Hạ tầng Thanh Sơn',
    ...records.map(r => r.to_ha_tang).filter(Boolean),
    ...stations.map(s => s.to_ha_tang).filter(Boolean)
  ])).sort();

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      {/* Top Title & Export Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Hồ sơ nhà trạm 5S</h2>
          <p className="text-xs text-slate-500 mt-1">Danh sách chi tiết hồ sơ khảo sát, đánh giá và lịch sử chấm điểm 5S kèm ảnh LH3 Google Drive</p>
        </div>

        <button
          onClick={exportToExcel}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Xuất File Excel</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm mã trạm, tên trạm..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedOrg}
            onChange={(e) => setSelectedOrg(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-vnpt-500"
          >
            <option value="Tất cả">Tất cả Tổ Hạ tầng</option>
            {availableOrgs.map(org => {
              const name = org.replace('Tổ Hạ tầng ', '');
              return (
                <option key={org} value={name}>{org.startsWith('Tổ Hạ tầng') ? org : `Tổ Hạ tầng ${org}`}</option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-6">Mã hồ sơ</th>
                <th className="py-3.5 px-6">Mã trạm</th>
                <th className="py-3.5 px-6">Tên nhà trạm</th>
                <th className="py-3.5 px-6">Tổ Hạ tầng</th>
                <th className="py-3.5 px-6">Ảnh LH3</th>
                <th className="py-3.5 px-6">Điểm trước</th>
                <th className="py-3.5 px-6">Điểm sau</th>
                <th className="py-3.5 px-6">Xếp loại</th>
                <th className="py-3.5 px-6 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {filteredRecords.map((row) => {
                const beforeImgs = parseSheetPhotoUrls(row.anh_truoc_list || row.anh_truoc_url);
                const afterImgs = parseSheetPhotoUrls(row.anh_sau_list || row.anh_sau_url);
                const totalImgs = beforeImgs.length + afterImgs.length;
                const thumb = afterImgs[0] || beforeImgs[0];

                return (
                  <tr key={row.id_ho_so} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-500 text-xs">{row.id_ho_so}</td>
                    <td className="py-4 px-6 font-bold text-vnpt-700">{row.ma_nha_tram}</td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{row.ten_nha_tram}</td>
                    <td className="py-4 px-6 text-slate-600">{row.to_ha_tang}</td>
                    <td className="py-4 px-6">
                      {thumb ? (
                        <div
                          onClick={() => setPreviewImage(thumb)}
                          className="flex items-center space-x-2 cursor-pointer group"
                        >
                          <img
                            src={toLh3Url(thumb)}
                            alt="Ảnh trạm"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-xs group-hover:scale-105 transition-transform"
                          />
                          <span className="text-[11px] font-semibold text-slate-500">
                            {totalImgs} ảnh
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Chưa có ảnh</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-bold">{row.tong_truoc}</td>
                    <td className="py-4 px-6 font-black text-vnpt-700">{row.tong_sau}</td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                        {row.xep_loai_sau}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => setSelectedDetail(row)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-vnpt-600 transition-colors cursor-pointer"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Overlay Drawer */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto p-6 space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-800">{selectedDetail.ma_nha_tram} - {selectedDetail.ten_nha_tram}</h3>
                <p className="text-xs text-slate-500">Mã hồ sơ: {selectedDetail.id_ho_so}</p>
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div><strong className="text-slate-500">Tổ Hạ tầng:</strong> <span className="font-semibold text-slate-800">{selectedDetail.to_ha_tang}</span></div>
              <div><strong className="text-slate-500">Người khảo sát:</strong> <span className="font-semibold text-slate-800">{selectedDetail.nguoi_khao_sat}</span></div>
              <div><strong className="text-slate-500">Ngày khảo sát:</strong> <span className="font-semibold text-slate-800">{selectedDetail.ngay_khao_sat}</span></div>
              <div><strong className="text-slate-500">Tái kiểm tra:</strong> <span className="font-semibold text-slate-800">{selectedDetail.ngay_tai_kiem_tra}</span></div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-sm text-slate-800">Chi tiết điểm 5S:</h4>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                <div className="bg-blue-50 p-2 rounded-lg"><div className="font-bold text-blue-700">S1</div><div>{selectedDetail.s1_sau}/20</div></div>
                <div className="bg-blue-50 p-2 rounded-lg"><div className="font-bold text-blue-700">S2</div><div>{selectedDetail.s2_sau}/20</div></div>
                <div className="bg-emerald-50 p-2 rounded-lg"><div className="font-bold text-emerald-700">S3</div><div>{selectedDetail.s3_sau}/25</div></div>
                <div className="bg-amber-50 p-2 rounded-lg"><div className="font-bold text-amber-700">S4</div><div>{selectedDetail.s4_sau}/20</div></div>
                <div className="bg-emerald-50 p-2 rounded-lg"><div className="font-bold text-emerald-700">S5</div><div>{selectedDetail.s5_sau}/15</div></div>
              </div>
            </div>

            {/* Photos in Detail Modal */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Image className="w-4 h-4 text-vnpt-500" />
                <span>Ảnh minh chứng 5S (Định dạng LH3 Google Drive)</span>
              </h4>

              {/* Before Photos */}
              {(() => {
                const beforeList = parseSheetPhotoUrls(selectedDetail.anh_truoc_list || selectedDetail.anh_truoc_url);
                return beforeList.length > 0 ? (
                  <div>
                    <div className="text-xs font-bold text-sky-800 mb-2 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-sky-600" />
                      <span>Ảnh hiện trạng trước 5S ({beforeList.length})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {beforeList.map((url, idx) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewImage(url)}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:scale-105 transition-transform bg-slate-100 relative group"
                        >
                          <img src={toLh3Url(url)} alt={`Ảnh trước ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* After Photos */}
              {(() => {
                const afterList = parseSheetPhotoUrls(selectedDetail.anh_sau_list || selectedDetail.anh_sau_url);
                return afterList.length > 0 ? (
                  <div>
                    <div className="text-xs font-bold text-emerald-800 mb-2 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ảnh kết quả sau 5S ({afterList.length})</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {afterList.map((url, idx) => (
                        <div
                          key={idx}
                          onClick={() => setPreviewImage(url)}
                          className="aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:scale-105 transition-transform bg-slate-100 relative group"
                        >
                          <img src={toLh3Url(url)} alt={`Ảnh sau ${idx + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="space-y-1 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-sm text-slate-800">Nội dung thực hiện:</h4>
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">{selectedDetail.noi_dung_thuc_hien}</p>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Image Preview */}
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
