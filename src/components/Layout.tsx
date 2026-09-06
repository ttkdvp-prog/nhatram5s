import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';
import { BottomNav } from './BottomNav';
import { DashboardView } from './DashboardView';
import { SurveyFormView } from './SurveyFormView';
import { StationRecordsView } from './StationRecordsView';
import { PhotoProgressView } from './PhotoProgressView';
import { ReportsView } from './ReportsView';
import { fetchDashboardData, saveSurveyForm } from '../services/api';
import { Station, SurveyRecord, Recommendation, DashboardKpi, OrgScoreSummary } from '../types';
import { Menu } from 'lucide-react';

export const Layout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  // Data state
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [kpis, setKpis] = useState<DashboardKpi>({ totalPlanned: 120, surveyed: 82, completed5S: 64, passRate: '84.4%', avgImprovement: '+19.4' });
  const [orgScores, setOrgScores] = useState<OrgScoreSummary[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [records, setRecords] = useState<SurveyRecord[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [selectedRecordForForm, setSelectedRecordForForm] = useState<SurveyRecord | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    const data = await fetchDashboardData();
    setKpis(data.kpis);
    setOrgScores(data.orgScores);
    setStations(data.stations);
    setRecords(data.records);
    setRecommendations(data.recommendations);
    setIsLive(data.isLive);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    loadData(false);
    // Vòng lặp đồng bộ tức thì 3 giây với Google Sheets
    const timer = setInterval(() => {
      loadData(true);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleSaveSurvey = async (formData: Partial<SurveyRecord>) => {
    await saveSurveyForm(formData);
    await loadData(true);
    setSelectedRecordForForm(null);
    setActiveTab('records');
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
        <header
          className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.6rem)' }}
        >
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={() => setIsOpenMobile(true)}
              className="lg:hidden -ml-1.5 p-2 rounded-xl text-slate-600 active:bg-slate-100 transition-colors"
              aria-label="Mở menu"
            >
              <Menu className="w-5.5 h-5.5" />
            </button>

            <span className="text-[11px] sm:text-xs font-extrabold text-vnpt-700 uppercase tracking-widest truncate">
              TRUNG TÂM HẠ TẦNG - VNPT PHÚ THỌ
            </span>
          </div>
        </header>

        {/* Dynamic Route View Scope */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
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

          {activeTab === 'photos' && (
            <PhotoProgressView
              stations={stations}
              records={records}
              onNavigateToSurvey={navigateToSurvey}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView kpis={kpis} orgScores={orgScores} />
          )}
        </main>
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};
