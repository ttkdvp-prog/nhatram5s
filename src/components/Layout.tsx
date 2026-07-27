import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';
import { DashboardView } from './DashboardView';
import { SurveyFormView } from './SurveyFormView';
import { StationRecordsView } from './StationRecordsView';
import { RecommendationsView } from './RecommendationsView';
import { ReportsView } from './ReportsView';
import { SettingsModal } from './SettingsModal';
import { fetchDashboardData, saveSurveyForm } from '../services/api';
import { Station, SurveyRecord, Recommendation, DashboardKpi, OrgScoreSummary } from '../types';
import { Menu, Settings, Database, RefreshCw } from 'lucide-react';

export const Layout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Data state
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [kpis, setKpis] = useState<DashboardKpi>({ totalPlanned: 120, surveyed: 82, completed5S: 64, passRate: '84.4%', avgImprovement: '+19.4' });
  const [orgScores, setOrgScores] = useState<OrgScoreSummary[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecordForForm, setSelectedRecordForForm] = useState<SurveyRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchDashboardData();
    setKpis(data.kpis);
    setOrgScores(data.orgScores);
    setStations(data.stations);
    setRecords(data.records);
    setRecommendations(data.recommendations);
    setIsLive(data.isLive);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSurvey = async (formData: Partial<SurveyRecord>) => {
    await saveSurveyForm(formData);
    await loadData();
    setActiveTab('overview');
  };

  const navigateToSurvey = (record?: SurveyRecord) => {
    setSelectedRecordForForm(record || null);
    setActiveTab('survey');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="hidden sm:block">
              <span className="text-xs font-extrabold text-vnpt-700 uppercase tracking-widest">
                VNPT TRUNG TÂM HẠ TẦNG PHÚ THỌ
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Live Data Badge */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isLive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isLive ? 'HỆ THỐNG TRỰC TUYẾN' : 'DỮ LIỆU MINH HỌA'}</span>
            </button>

            <button
              onClick={loadData}
              className="p-2 text-slate-500 hover:text-vnpt-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Tải lại dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              title="Cấu hình kết nối hệ thống"
            >
              <Settings className="w-4 h-4 text-vnpt-700" />
            </button>
          </div>
        </header>

        {/* Dynamic Route View Scope */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <DashboardView
              kpis={kpis}
              orgScores={orgScores}
              records={records}
              recommendations={recommendations}
              stations={stations}
              isLive={isLive}
              onNavigateToSurvey={navigateToSurvey}
            />
          )}

          {activeTab === 'survey' && (
            <SurveyFormView
              stations={stations}
              onSave={handleSaveSurvey}
              initialRecord={selectedRecordForForm}
            />
          )}

          {activeTab === 'records' && (
            <StationRecordsView stations={stations} records={records} />
          )}

          {activeTab === 'recommendations' && (
            <RecommendationsView recommendations={recommendations} />
          )}

          {activeTab === 'reinspection' && (
            <RecommendationsView recommendations={recommendations} />
          )}

          {activeTab === 'reports' && (
            <ReportsView kpis={kpis} orgScores={orgScores} />
          )}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
};
