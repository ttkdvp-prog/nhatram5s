import React from 'react';
import { DashboardKpi, OrgScoreSummary } from '../types';
import { BarChart3, TrendingUp, ShieldCheck, Award } from 'lucide-react';

interface ReportsViewProps {
  kpis: DashboardKpi;
  orgScores: OrgScoreSummary[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ kpis, orgScores }) => {
  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Báo cáo Tổng hợp 5S</h2>
        <p className="text-xs text-slate-500 mt-1">Báo cáo kết quả duy trì điều kiện lao động, an toàn và phong trào 5S toàn Trung tâm</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Xếp hạng phong trào 5S các Tổ Hạ tầng</span>
          </h3>
          <div className="space-y-3">
            {orgScores.map((org, index) => (
              <div key={org.to_ha_tang} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-3">
                  <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center ${
                    index === 0 ? 'bg-amber-400 text-white' : index === 1 ? 'bg-slate-300 text-slate-700' : 'bg-amber-700/20 text-amber-900'
                  }`}>
                    {index + 1}
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">Tổ Hạ tầng {org.to_ha_tang}</span>
                </div>
                <div className="text-right">
                  <span className="font-black text-vnpt-700 text-base">{org.scoreAfter}</span>
                  <span className="text-xs text-emerald-600 font-bold ml-1.5">(+{org.scoreAfter - org.scoreBefore})</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <span>Tóm tắt chỉ số hoàn thành</span>
          </h3>
          <div className="space-y-4 text-xs font-semibold text-slate-700">
            <div className="flex justify-between p-3 bg-emerald-50 rounded-xl text-emerald-900">
              <span>Tỷ lệ nhà trạm đạt chuẩn 5S:</span>
              <span className="font-black text-sm">{kpis.passRate}</span>
            </div>
            <div className="flex justify-between p-3 bg-blue-50 rounded-xl text-blue-900">
              <span>Điểm cải thiện bình quân:</span>
              <span className="font-black text-sm">{kpis.avgImprovement}</span>
            </div>
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl text-slate-800">
              <span>Tổng nhà trạm đã khảo sát:</span>
              <span className="font-black text-sm">{kpis.surveyed} / {kpis.totalPlanned}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
