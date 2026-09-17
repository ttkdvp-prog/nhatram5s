import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';
import { BottomNav } from './BottomNav';
import { DashboardView } from './DashboardView';
import { SurveyFormView } from './SurveyFormView';
import { StationRecordsView } from './StationRecordsView';
import { PhotoProgressView } from './PhotoProgressView';
import { ReportsView } from './ReportsView';
import { BtsInspectionView } from './BtsInspectionView';
import { fetchDashboardData, saveSurveyForm } from '../services/api';
import { Station, SurveyRecord, Recommendation, DashboardKpi, OrgScoreSummary, BtsInspection } from '../types';
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
  const [btsInspections, setBtsInspections] = useState<BtsInspection[]>([]);
  const [selectedRecordForForm, setSelectedRecordForForm] = useState<SurveyRecord | null>(null);

  // Nhớ các trạm BTS vừa được sửa tại chỗ (optimistic) để vòng lặp đồng bộ 3s không ghi đè
  // ngược lại bằng dữ liệu server cũ hơn trước khi backend kịp lưu xong - tránh hiện tượng
  // "nhấp nháy" khiến người dùng tưởng thao tác bị chậm/chưa ăn.
  const recentBtsUpdatesRef = useRef<Map<string, number>>(new Map());
  const RECENT_BTS_UPDATE_TTL_MS = 6000;

  // Chặn không cho 2 lần gọi loadData chồng lên nhau - backend Apps Script đôi khi phản hồi
  // chậm (vài giây đến hàng chục giây khi tải), nếu không chặn thì vòng lặp 3s cứ bắn thêm
  // request mới trong khi request cũ chưa xong, khiến các request dồn ứ và ngày càng chậm hơn.
  const isLoadingRef = useRef(false);

  const loadData = async (silent = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    if (!silent) setLoading(true);
    try {
    const data = await fetchDashboardData();
    setKpis(data.kpis);
    setOrgScores(data.orgScores);
    setStations(data.stations);
    setRecords(data.records);
    setRecommendations(data.recommendations);
    setIsLive(data.isLive);

    setBtsInspections(prevLocal => {
      const serverList = data.btsInspections || [];
      const now = Date.now();
      const recentMap = recentBtsUpdatesRef.current;
      // Dọn các mốc thời gian đã quá hạn
      recentMap.forEach((ts, id) => {
        if (now - ts > RECENT_BTS_UPDATE_TTL_MS) recentMap.delete(id);
      });
      if (recentMap.size === 0) return serverList;

      const merged = serverList.map(serverRow => {
        if (recentMap.has(serverRow.id_nha_tram)) {
          const localRow = prevLocal.find(b => b.id_nha_tram === serverRow.id_nha_tram);
          if (localRow) return localRow;
        }
        return serverRow;
      });
      // Giữ lại các trạm mới tạo cục bộ mà server chưa kịp trả về
      prevLocal.forEach(localRow => {
        if (recentMap.has(localRow.id_nha_tram) && !merged.some(m => m.id_nha_tram === localRow.id_nha_tram)) {
          merged.push(localRow);
        }
      });
      return merged;
    });

    } finally {
      if (!silent) setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleBtsInspectionUpdated = (updated: BtsInspection) => {
    recentBtsUpdatesRef.current.set(updated.id_nha_tram, Date.now());
    setBtsInspections(prev => {
      const exists = prev.some(b => b.id_nha_tram === updated.id_nha_tram);
      return exists ? prev.map(b => (b.id_nha_tram === updated.id_nha_tram ? updated : b)) : [...prev, updated];
    });
  };

  useEffect(() => {
    loadData(false);
    // Vòng lặp đồng bộ với Google Sheets - giãn ra 8s (thay vì 3s) vì backend Apps Script đọc
    // sheet ~1900 dòng có thể mất vài giây; kết hợp với isLoadingRef ở trên để không bao giờ
    // có 2 request chồng nhau làm dồn ứ và ngày càng chậm dần theo thời gian dùng.
    const timer = setInterval(() => {
      loadData(true);
    }, 8000);
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

          {activeTab === 'btsInspection' && (
            <BtsInspectionView
              stations={stations}
              btsInspections={btsInspections}
              onUpdated={handleBtsInspectionUpdated}
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
