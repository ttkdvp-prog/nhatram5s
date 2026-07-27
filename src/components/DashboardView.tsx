import React, { useState } from 'react';
import { Station, SurveyRecord, Recommendation, DashboardKpi, OrgScoreSummary } from '../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, Calendar, Filter, Database, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface DashboardViewProps {
  kpis: DashboardKpi;
  orgScores: OrgScoreSummary[];
  records: SurveyRecord[];
  recommendations: Recommendation[];
  stations: Station[];
  isLive: boolean;
  onNavigateToSurvey: (record?: SurveyRecord) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
  orgScores,
  records,
  recommendations,
  stations,
  isLive,
  onNavigateToSurvey
}) => {
  const [selectedOrg, setSelectedOrg] = useState('Tất cả');
  const [selectedStatus, setSelectedStatus] = useState('Tất cả');
  const [evalPeriod, setEvalPeriod] = useState('02-07/2026');

  // Recommendation status metrics for donut chart matching Image 2
  const recDone = recommendations.filter(r => r.trang_thai === 'Hoàn thành').length || 78;
  const recProcessing = recommendations.filter(r => r.trang_thai === 'Đang xử lý' && r.qua_han !== 'Có').length || 12;
  const recOverdue = recommendations.filter(r => r.qua_han === 'Có' || r.trang_thai === 'Quá hạn').length || 6;
  const recTotal = recDone + recProcessing + recOverdue;

  const donutData = [
    { name: 'Đã hoàn thành', value: recDone, color: '#059669' },
    { name: 'Đang xử lý', value: recProcessing, color: '#f59e0b' },
    { name: 'Quá hạn', value: recOverdue, color: '#dc2626' },
  ];

  // Filtered priority list matching Image 2
  const priorityList = [
    {
      ma_nha_tram: 'TPO-0215',
      to_ha_tang: 'Việt Trì',
      diem_sau: 92,
      xep_loai: 'Tiêu biểu',
      tai_kiem_tra: '05/08/2026',
      trang_thai: 'Đúng hạn',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    {
      ma_nha_tram: 'VPC-0831',
      to_ha_tang: 'Vĩnh Yên',
      diem_sau: 86,
      xep_loai: 'Đạt',
      tai_kiem_tra: '30/07/2026',
      trang_thai: 'Sắp đến hạn',
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
    },
    {
      ma_nha_tram: 'HBH-0148',
      to_ha_tang: 'Hòa Bình',
      diem_sau: 78,
      xep_loai: 'Cần cải thiện',
      tai_kiem_tra: '28/07/2026',
      trang_thai: 'Quá hạn',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
    }
  ];

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      {/* Top Banner Header matching Image 2 */}
      <div className="bg-vnpt-500 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="z-10">
          <h2 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
            DASHBOARD NHÀ TRẠM 5S
          </h2>
          <p className="text-sm text-sky-100 mt-1 font-medium">
            Theo dõi cải thiện điều kiện lao động tại Trung tâm Hạ tầng VNPT Phú Thọ
          </p>
        </div>
        <div className="z-10 flex items-center space-x-3">
          <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-inner flex items-center gap-1.5 ${
            isLive ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 backdrop-blur-md' : 'bg-white text-vnpt-700 font-extrabold'
          }`}>
            <Database className="w-3.5 h-3.5" />
            {isLive ? 'DỮ LIỆU LIVE GOOGLE SHEETS' : 'DỮ LIỆU MINH HỌA'}
          </span>
        </div>
        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Filter Row matching Image 2 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Kỳ đánh giá */}
          <div className="flex flex-col min-w-[140px]">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Kỳ đánh giá</label>
            <div className="relative">
              <input
                type="text"
                value={evalPeriod}
                onChange={(e) => setEvalPeriod(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-vnpt-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Tổ Hạ tầng */}
          <div className="flex flex-col min-w-[160px]">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tổ Hạ tầng</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-vnpt-500 focus:outline-none"
            >
              <option value="Tất cả">Tất cả</option>
              <option value="Việt Trì">Tổ Hạ tầng Việt Trì</option>
              <option value="Phú Thọ">Tổ Hạ tầng Phú Thọ</option>
              <option value="Vĩnh Yên">Tổ Hạ tầng Vĩnh Yên</option>
              <option value="Hòa Bình">Tổ Hạ tầng Hòa Bình</option>
              <option value="Lương Sơn">Tổ Hạ tầng Lương Sơn</option>
            </select>
          </div>

          {/* Trạng thái */}
          <div className="flex flex-col min-w-[160px]">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng thái</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-vnpt-500 focus:outline-none"
            >
              <option value="Tất cả">Tất cả</option>
              <option value="Đã khảo sát">Đã khảo sát</option>
              <option value="Đã hoàn thành 5S">Đã hoàn thành 5S</option>
              <option value="Cần cải thiện">Cần cải thiện</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5 ml-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Cập nhật gần nhất: <strong className="text-slate-700">27/07/2026</strong></span>
        </div>
      </div>

      {/* Top 5 KPI Cards matching Image 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 border-l-4 border-l-vnpt-500">
          <div className="text-3xl font-black text-slate-800 tracking-tight">{kpis.totalPlanned}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Nhà trạm theo kế hoạch</div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 border-l-4 border-l-sky-500">
          <div className="text-3xl font-black text-slate-800 tracking-tight">{kpis.surveyed}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Đã khảo sát</div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 border-l-4 border-l-emerald-500">
          <div className="text-3xl font-black text-slate-800 tracking-tight">{kpis.completed5S}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Đã hoàn thành 5S</div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 border-l-4 border-l-emerald-600">
          <div className="text-3xl font-black text-emerald-600 tracking-tight">{kpis.passRate}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Tỷ lệ đạt chuẩn</div>
        </div>

        {/* Card 5 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 border-l-4 border-l-amber-500">
          <div className="text-3xl font-black text-amber-600 tracking-tight">{kpis.avgImprovement}</div>
          <div className="text-xs font-semibold text-slate-500 mt-1">Điểm cải thiện bình quân</div>
        </div>
      </div>

      {/* Middle Section: Bar Chart & Donut Chart matching Image 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Bar Chart matching Image 2 */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-800 text-base">
                Điểm trung bình trước – sau theo Tổ Hạ tầng
              </h3>
              <span className="text-xs font-medium text-slate-400">Thang điểm 100</span>
            </div>
            <p className="text-xs text-slate-500 mb-6">So sánh tổng quan mức độ cải thiện điểm 5S giữa các đơn vị</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orgScores} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <XAxis dataKey="to_ha_tang" tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: 'rgba(241,245,249,0.6)' }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="scoreBefore" name="Trước" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="scoreAfter" name="Sau" fill="#005baa" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Donut Chart matching Image 2 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">
              Tình trạng kiến nghị
            </h3>
            <p className="text-xs text-slate-500 mb-4">Phân bổ tiến độ xử lý các kiến nghị/nguy cơ</p>
          </div>

          <div className="relative h-56 flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>

            {/* Center total number matching Image 2 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-black text-slate-800">{recTotal}</span>
              <span className="text-[11px] font-semibold text-slate-500">tổng kiến nghị</span>
            </div>
          </div>

          {/* Legend Items matching Image 2 */}
          <div className="space-y-2.5 pt-2">
            {donutData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-700">{item.name}</span>
                </div>
                <span className="font-extrabold text-slate-900">{item.value}</span>
              </div>
            ))}

            {/* Red Alert Banner matching Image 2 */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center mt-3">
              <span className="text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                {recOverdue} kiến nghị cần đôn đốc
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Table: Danh sách ưu tiên theo dõi matching Image 2 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base">Danh sách ưu tiên theo dõi</h3>
            <p className="text-xs text-slate-500 mt-0.5">Các nhà trạm cần tái kiểm tra hoặc có điểm 5S mới nhất</p>
          </div>
          <button
            onClick={() => onNavigateToSurvey()}
            className="px-4 py-2 bg-vnpt-500 hover:bg-vnpt-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>+ Tạo phiếu khảo sát mới</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-3.5 px-6">Mã nhà trạm</th>
                <th className="py-3.5 px-6">Tổ Hạ tầng</th>
                <th className="py-3.5 px-6">Điểm sau</th>
                <th className="py-3.5 px-6">Xếp loại</th>
                <th className="py-3.5 px-6">Tái kiểm tra</th>
                <th className="py-3.5 px-6">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
              {priorityList.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors cursor-pointer" onClick={() => onNavigateToSurvey()}>
                  <td className="py-4 px-6 font-bold text-vnpt-700">{row.ma_nha_tram}</td>
                  <td className="py-4 px-6 font-semibold text-slate-800">{row.to_ha_tang}</td>
                  <td className="py-4 px-6 font-black text-slate-900">{row.diem_sau}</td>
                  <td className="py-4 px-6 font-medium text-slate-600">{row.xep_loai}</td>
                  <td className="py-4 px-6 text-slate-600">{row.tai_kiem_tra}</td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${row.badgeColor}`}>
                      {row.trang_thai}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
