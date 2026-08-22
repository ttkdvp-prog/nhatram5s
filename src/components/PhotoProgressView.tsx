import React, { useState, useMemo } from 'react';
import { Station, SurveyRecord } from '../types';
import { CANONICAL_ORGS } from '../data/initialData';
import { toLh3Url } from '../utils/imageHelper';
import { ImageLightbox, LightboxPhoto } from './ImageLightbox';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Filter,
  Users,
  Target,
  Trophy,
  Calendar,
  Building2,
  ExternalLink,
  Layers,
  ChevronRight,
  TrendingUp,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Flame,
  Award,
  Eye
} from 'lucide-react';

interface PhotoProgressViewProps {
  stations: Station[];
  records: SurveyRecord[];
  onNavigateToSurvey?: (record?: SurveyRecord) => void;
}

export interface StationPhotoStatus {
  station: Station;
  record?: SurveyRecord;
  hasBefore: boolean;
  hasAfter: boolean;
  isComplete: boolean;
  isPartial: boolean;
  isEmpty: boolean;
  beforePhotos: string[];
  afterPhotos: string[];
  statusText: string;
  statusColor: string;
  month: string;
  surveyDate: string;
}

export interface OrgMonthlyPlanSummary {
  orgName: string;
  employeeCount: number;      // Số nhân viên trong tổ (không tính tổ trưởng)
  employeeList: string[];     // Danh sách tên nhân viên
  targetStations: number;     // Kế hoạch giao = Số NV x 2
  performedCount: number;     // Số trạm đã thực hiện 5S trong tháng
  completeCount: number;      // Đủ cả 2 ảnh
  partialCount: number;       // Chỉ 1 ảnh
  beforeOnlyCount: number;
  afterOnlyCount: number;
  completionRate: number;     // Tỷ lệ % hoàn thành kế hoạch tháng (performedCount / targetStations)
  statusBadge: string;
  statusBadgeColor: string;
}

// Hàm chuẩn hóa chuỗi và tách tháng từ chuỗi ngày (vd: "22/08/2026" -> "Tháng 08/2026")
const getRecordMonth = (dateStr?: string): string => {
  if (!dateStr) return 'Tháng 08/2026';
  const str = dateStr.trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length >= 3) {
      const month = parts[1].padStart(2, '0');
      const year = parts[2].split(' ')[0];
      return `Tháng ${month}/${year}`;
    }
  }
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      return `Tháng ${month}/${year}`;
    }
  }
  return 'Tháng 08/2026';
};

// Chuẩn hóa tìm kiếm không dấu và viết tắt
const normalizeSearch = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim();
};

const matchesSearch = (text: string, subText: string | undefined, query: string): boolean => {
  if (!query.trim()) return true;
  const q = normalizeSearch(query);
  const target = normalizeSearch(text);
  const sub = normalizeSearch(subText || '');

  if (target.includes(q) || sub.includes(q)) return true;

  const words = (target + ' ' + sub).split(/\s+/).filter(Boolean);
  const initials = words.map((w) => w[0]).join('');
  if (initials.includes(q.replace(/\s+/g, ''))) return true;

  const queryTokens = q.split(/\s+/).filter(Boolean);
  return queryTokens.every((tok) => target.includes(tok) || sub.includes(tok));
};

export const PhotoProgressView: React.FC<PhotoProgressViewProps> = ({
  stations,
  records,
  onNavigateToSurvey
}) => {
  // Lấy tháng hiện tại làm mặc định
  const now = new Date();
  const currentMonthStr = `Tháng ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('Tất cả');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Danh sách các tháng khả dụng từ dữ liệu hồ sơ
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    months.add(currentMonthStr);
    records.forEach((r) => {
      const m = getRecordMonth(r.ngay_khao_sat);
      if (m) months.add(m);
    });
    return Array.from(months).sort().reverse();
  }, [records, currentMonthStr]);

  // Tra cứu nhanh O(1) Station và Record
  const stationMap = useMemo(() => {
    const map = new Map<string, Station>();
    stations.forEach((s) => map.set(s.ma_nha_tram, s));
    return map;
  }, [stations]);

  // 1. Phân tích chi tiết các trạm ĐÃ THỰC HIỆN 5S (kèm theo tháng khảo sát)
  const performed5SStatuses: StationPhotoStatus[] = useMemo(() => {
    return records.map((rec) => {
      const st = stationMap.get(rec.ma_nha_tram) || {
        id_nha_tram: rec.ma_nha_tram,
        ma_nha_tram: rec.ma_nha_tram,
        ten_nha_tram: rec.ten_nha_tram || `Nhà trạm ${rec.ma_nha_tram}`,
        to_ha_tang: rec.to_ha_tang || 'Chưa phân tổ',
        dia_ban: '',
        loai_nha_tram: 'BTS',
        dia_chi: '',
        co_may_phat: 'Không',
        nguoi_phu_trach: rec.nguoi_khao_sat || '',
        trang_thai: 'Hoạt động'
      };

      let beforeList: string[] = [];
      let afterList: string[] = [];

      if (rec.anh_truoc_list && rec.anh_truoc_list.length > 0) {
        beforeList = rec.anh_truoc_list;
      } else if (rec.anh_truoc_url) {
        beforeList = [rec.anh_truoc_url];
      }

      if (rec.anh_sau_list && rec.anh_sau_list.length > 0) {
        afterList = rec.anh_sau_list;
      } else if (rec.anh_sau_url) {
        afterList = [rec.anh_sau_url];
      }

      const hasBefore = beforeList.length > 0;
      const hasAfter = afterList.length > 0;
      const isComplete = hasBefore && hasAfter;
      const isPartial = (hasBefore && !hasAfter) || (!hasBefore && hasAfter);
      const isEmpty = !hasBefore && !hasAfter;

      let statusText = 'Chưa có ảnh';
      let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';

      if (isComplete) {
        statusText = 'Đủ 2 ảnh Trước & Sau';
        statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      } else if (hasBefore && !hasAfter) {
        statusText = 'Chỉ có ảnh Trước';
        statusColor = 'bg-amber-50 text-amber-700 border-amber-200';
      } else if (!hasBefore && hasAfter) {
        statusText = 'Chỉ có ảnh Sau';
        statusColor = 'bg-blue-50 text-blue-700 border-blue-200';
      }

      const recMonth = getRecordMonth(rec.ngay_khao_sat);

      return {
        station: st,
        record: rec,
        hasBefore,
        hasAfter,
        isComplete,
        isPartial,
        isEmpty,
        beforePhotos: beforeList.map(toLh3Url),
        afterPhotos: afterList.map(toLh3Url),
        statusText,
        statusColor,
        month: recMonth,
        surveyDate: rec.ngay_khao_sat || ''
      };
    });
  }, [records, stationMap]);

  // 2. Thống kê theo 9 Tổ Hạ tầng: KẾ HOẠCH GIAO = (Số nhân viên không tính tổ trưởng) x 2
  const orgSummaries: OrgMonthlyPlanSummary[] = useMemo(() => {
    const liveOrgs = Array.from(new Set(stations.map((s) => s.to_ha_tang).filter(Boolean)));
    const orgList = liveOrgs.length > 0 ? liveOrgs.sort() : CANONICAL_ORGS;

    return orgList.map((org) => {
      const cleanOrg = org.replace('Tổ Hạ tầng ', '').trim();
      const orgStations = stations.filter((s) => s.to_ha_tang.includes(cleanOrg));

      // Lấy danh sách nhân viên trong tổ (LOẠI TRỪ Tổ trưởng và Admin)
      const rawEmployees = Array.from(
        new Set(
          orgStations
            .map((s) => s.nguoi_phu_trach)
            .filter(Boolean)
            .filter(
              (name) =>
                !name.toLowerCase().includes('tổ trưởng') &&
                !name.toLowerCase().includes('admin')
            )
        )
      );

      // Nếu tổ chưa có nhân viên được gán, mặc định 2 nhân viên
      const employeeList = rawEmployees.length > 0 ? rawEmployees : [`NV ${cleanOrg} 01`, `NV ${cleanOrg} 02`];
      const employeeCount = employeeList.length;

      // KẾ HOẠCH GIAO = SỐ NHÂN VIÊN TRONG TỔ x 2 (mỗi người 2 trạm/tháng)
      const targetStations = employeeCount * 2;

      // Lọc các trạm của tổ này đã thực hiện 5S trong tháng được chọn (hoặc tất cả các tháng)
      const orgPerformedInMonth = performed5SStatuses.filter((s) => {
        const matchOrg = s.station.to_ha_tang.includes(cleanOrg);
        const matchMonth = selectedMonth === 'Tất cả' || s.month === selectedMonth;
        return matchOrg && matchMonth;
      });

      const performedCount = orgPerformedInMonth.length;
      const completeCount = orgPerformedInMonth.filter((s) => s.isComplete).length;
      const beforeOnlyCount = orgPerformedInMonth.filter((s) => s.hasBefore && !s.hasAfter).length;
      const afterOnlyCount = orgPerformedInMonth.filter((s) => !s.hasBefore && s.hasAfter).length;
      const partialCount = orgPerformedInMonth.filter((s) => s.isPartial).length;

      // Tỷ lệ hoàn thành kế hoạch tháng (%)
      const completionRate = targetStations > 0 ? Math.round((performedCount / targetStations) * 100) : 0;

      let statusBadge = 'Chưa đạt';
      let statusBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200';

      if (completionRate >= 100) {
        statusBadge = completionRate > 100 ? 'Vượt chỉ tiêu 🏆' : 'Đạt kế hoạch ✅';
        statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      } else if (completionRate >= 70) {
        statusBadge = 'Tiến độ tốt ⏳';
        statusBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
      } else if (completionRate >= 40) {
        statusBadge = 'Đang triển khai ⚠️';
        statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
      }

      return {
        orgName: org.startsWith('Tổ Hạ tầng') ? org : `Tổ Hạ tầng ${org}`,
        employeeCount,
        employeeList,
        targetStations,
        performedCount,
        completeCount,
        partialCount,
        beforeOnlyCount,
        afterOnlyCount,
        completionRate,
        statusBadge,
        statusBadgeColor
      };
    });
  }, [stations, performed5SStatuses, selectedMonth]);

  // Tổng hợp toàn mạng KPI theo tháng
  const networkTotals = useMemo(() => {
    const totalEmployees = orgSummaries.reduce((acc, o) => acc + o.employeeCount, 0);
    const totalTarget = orgSummaries.reduce((acc, o) => acc + o.targetStations, 0);
    const totalPerformed = orgSummaries.reduce((acc, o) => acc + o.performedCount, 0);
    const totalComplete = orgSummaries.reduce((acc, o) => acc + o.completeCount, 0);
    const totalPartial = orgSummaries.reduce((acc, o) => acc + o.partialCount, 0);
    const totalBeforeOnly = orgSummaries.reduce((acc, o) => acc + o.beforeOnlyCount, 0);
    const totalAfterOnly = orgSummaries.reduce((acc, o) => acc + o.afterOnlyCount, 0);
    const overallRate = totalTarget > 0 ? Math.round((totalPerformed / totalTarget) * 100) : 0;

    return {
      totalEmployees,
      totalTarget,
      totalPerformed,
      totalComplete,
      totalPartial,
      totalBeforeOnly,
      totalAfterOnly,
      overallRate
    };
  }, [orgSummaries]);

  // 3. Lọc danh sách trạm chi tiết theo Tháng + Tổ + Trạng thái + Tìm kiếm
  const filteredStationStatuses = useMemo(() => {
    return performed5SStatuses.filter((item) => {
      // Lọc theo Tháng
      const matchMonth = selectedMonth === 'Tất cả' || item.month === selectedMonth;

      // Lọc theo Tổ
      const cleanFilterOrg = selectedOrgFilter.replace('Tổ Hạ tầng ', '').trim();
      const matchOrg =
        selectedOrgFilter === 'Tất cả' ||
        item.station.to_ha_tang.includes(cleanFilterOrg);

      // Lọc theo Trạng thái ảnh
      let matchStatus = true;
      if (selectedStatusFilter === 'complete') matchStatus = item.isComplete;
      else if (selectedStatusFilter === 'before_only') matchStatus = item.hasBefore && !item.hasAfter;
      else if (selectedStatusFilter === 'after_only') matchStatus = !item.hasBefore && item.hasAfter;
      else if (selectedStatusFilter === 'partial') matchStatus = item.isPartial;

      // Lọc theo Tìm kiếm
      const matchQuery = matchesSearch(
        `${item.station.ma_nha_tram} ${item.station.ten_nha_tram} ${item.station.nguoi_phu_trach || ''} ${item.station.ma_nv || ''}`,
        item.station.to_ha_tang,
        searchQuery
      );

      return matchMonth && matchOrg && matchStatus && matchQuery;
    });
  }, [performed5SStatuses, selectedMonth, selectedOrgFilter, selectedStatusFilter, searchQuery]);

  // Phân trang danh sách chi tiết
  const totalPages = Math.ceil(filteredStationStatuses.length / pageSize) || 1;
  const paginatedStationStatuses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStationStatuses.slice(start, start + pageSize);
  }, [filteredStationStatuses, currentPage, pageSize]);

  const openLightboxForStation = (item: StationPhotoStatus, initialType: 'before' | 'after' = 'before') => {
    const list: LightboxPhoto[] = [];
    item.beforePhotos.forEach((url, i) => {
      list.push({
        url,
        title: `Ảnh Trước 5S - ${item.station.ma_nha_tram} (#${i + 1})`,
        type: 'Trước'
      });
    });
    item.afterPhotos.forEach((url, i) => {
      list.push({
        url,
        title: `Ảnh Sau 5S - ${item.station.ma_nha_tram} (#${i + 1})`,
        type: 'Sau'
      });
    });

    if (list.length === 0) return;

    let targetIdx = 0;
    if (initialType === 'after' && item.beforePhotos.length > 0) {
      targetIdx = item.beforePhotos.length;
    }

    setLightboxPhotos(list);
    setLightboxIndex(targetIdx);
    setLightboxOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Lightbox Viewer */}
      <ImageLightbox
        isOpen={lightboxOpen}
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      {/* Header Banner with Month Selector */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-vnpt-50 text-vnpt-600 border border-vnpt-100">
              <Target className="w-6 h-6 text-vnpt-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Tiến độ thực hiện 5S theo tháng
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Kế hoạch giao: <strong className="text-vnpt-700 font-bold">02 trạm / nhân viên / tháng</strong> (Số nhân viên trong tổ không tính Tổ trưởng × 2)
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 px-2 text-slate-600 font-bold text-xs">
            <Calendar className="w-4 h-4 text-vnpt-600" />
            <span>Kỳ đánh giá:</span>
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-extrabold text-sm text-vnpt-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-vnpt-500 cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {m} {m === currentMonthStr ? '(Hiện tại)' : ''}
              </option>
            ))}
            <option value="Tất cả">Toàn bộ các tháng (Lũy kế)</option>
          </select>
        </div>
      </div>

      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Nhân lực thực hiện */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhân lực thực hiện</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-600">{networkTotals.totalEmployees}</span>
            <span className="text-xs font-bold text-slate-400">nhân viên (9 Tổ)</span>
          </div>
          <p className="mt-3 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            👥 Không tính 9 Tổ trưởng quản lý
          </p>
        </div>

        {/* KPI 2: Kế hoạch giao tháng */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kế hoạch giao ({selectedMonth})</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-600">{networkTotals.totalTarget}</span>
            <span className="text-xs font-bold text-slate-400">nhà trạm cần 5S</span>
          </div>
          <p className="mt-3 text-[11px] font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
            🎯 Định mức: <strong>{networkTotals.totalEmployees} NV × 2 trạm</strong>
          </p>
        </div>

        {/* KPI 3: Thực tế đã thực hiện */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Thực tế đã thực hiện</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600">{networkTotals.totalPerformed}</span>
            <span className="text-xs font-bold text-slate-400">/ {networkTotals.totalTarget} trạm</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] font-semibold">
            <span className="text-emerald-700">✅ {networkTotals.totalComplete} đủ 2 ảnh</span>
            <span className="text-amber-600">⏳ {networkTotals.totalPartial} đang làm</span>
          </div>
        </div>

        {/* KPI 4: Tỷ lệ hoàn thành kế hoạch */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ hoàn thành KH</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black ${
                networkTotals.overallRate >= 100
                  ? 'text-emerald-600'
                  : networkTotals.overallRate >= 70
                  ? 'text-blue-600'
                  : 'text-amber-600'
              }`}
            >
              {networkTotals.overallRate}%
            </span>
            <span className="text-xs font-bold text-slate-400">toàn mạng</span>
          </div>
          <div className="mt-3">
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  networkTotals.overallRate >= 100
                    ? 'bg-emerald-500'
                    : networkTotals.overallRate >= 70
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, networkTotals.overallRate)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: Bảng tổng hợp Kế hoạch & Thực hiện 9 Tổ Hạ tầng */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Building2 className="w-5 h-5 text-vnpt-500" />
              <span>Bảng theo dõi kế hoạch 5S theo Tổ Hạ tầng ({selectedMonth})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Định mức kế hoạch: Mỗi nhân viên 5S 02 trạm/tháng (Số NV trong tổ không tính tổ trưởng × 2)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-vnpt-700 rounded-xl text-xs font-black border border-blue-200">
              Kỳ: {selectedMonth}
            </span>
          </div>
        </div>

        {/* Table of 9 Teams Plan & Progress */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-y border-slate-200">
                <th className="py-3 px-3">Tổ Hạ tầng</th>
                <th className="py-3 px-2 text-center">Số NV (không tính Tổ trưởng)</th>
                <th className="py-3 px-2 text-center bg-purple-50/50 text-purple-800 font-black">Kế hoạch giao (Trạm)</th>
                <th className="py-3 px-2 text-center bg-emerald-50/50 text-emerald-800 font-black">Đã thực hiện 5S</th>
                <th className="py-3 px-2 text-center text-emerald-700">Đủ 2 ảnh</th>
                <th className="py-3 px-2 text-center text-amber-700">Chỉ 1 ảnh</th>
                <th className="py-3 px-3 text-center">Tiến độ KH (%)</th>
                <th className="py-3 px-3 text-center">Đánh giá</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {orgSummaries.map((org) => {
                const isSelected = selectedOrgFilter === org.orgName;
                return (
                  <tr
                    key={org.orgName}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isSelected ? 'bg-blue-50/40 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-vnpt-500 shrink-0" />
                      <span>{org.orgName}</span>
                    </td>

                    <td className="py-3 px-2 text-center font-bold text-slate-700">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold" title={org.employeeList.join(', ')}>
                        {org.employeeCount} NV
                      </span>
                    </td>

                    <td className="py-3 px-2 text-center font-black text-purple-700 bg-purple-50/30 text-sm">
                      {org.targetStations}
                    </td>

                    <td className="py-3 px-2 text-center font-black text-emerald-700 bg-emerald-50/30 text-sm">
                      {org.performedCount}
                    </td>

                    <td className="py-3 px-2 text-center font-bold text-emerald-600">
                      {org.completeCount}
                    </td>

                    <td className="py-3 px-2 text-center font-bold text-amber-600">
                      {org.partialCount}
                    </td>

                    <td className="py-3 px-3 text-center min-w-[130px]">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className={`h-full rounded-full ${
                              org.completionRate >= 100
                                ? 'bg-emerald-500'
                                : org.completionRate >= 70
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(100, org.completionRate)}%` }}
                          />
                        </div>
                        <span className="font-black text-xs text-slate-800 min-w-[32px] text-right">
                          {org.completionRate}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${org.statusBadgeColor}`}>
                        {org.statusBadge}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrgFilter(org.orgName);
                          setCurrentPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-vnpt-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-vnpt-50 hover:text-vnpt-700 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {isSelected ? 'Đang chọn' : 'Xem trạm'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Tổng cộng footer */}
            <tfoot>
              <tr className="bg-slate-100/80 font-black text-slate-800 border-t-2 border-slate-300">
                <td className="py-3 px-3 uppercase tracking-wider">Tổng cộng toàn mạng</td>
                <td className="py-3 px-2 text-center text-sm">{networkTotals.totalEmployees} NV</td>
                <td className="py-3 px-2 text-center text-sm text-purple-800 bg-purple-100/50">{networkTotals.totalTarget} trạm</td>
                <td className="py-3 px-2 text-center text-sm text-emerald-800 bg-emerald-100/50">{networkTotals.totalPerformed} trạm</td>
                <td className="py-3 px-2 text-center text-sm text-emerald-700">{networkTotals.totalComplete}</td>
                <td className="py-3 px-2 text-center text-sm text-amber-700">{networkTotals.totalPartial}</td>
                <td className="py-3 px-3 text-center text-sm text-emerald-800">{networkTotals.overallRate}% KH</td>
                <td className="py-3 px-3 text-center text-xs text-slate-600">
                  {networkTotals.overallRate >= 100 ? '🎉 Hoàn thành' : 'Đang thực hiện'}
                </td>
                <td className="py-3 px-3 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrgFilter('Tất cả');
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-300 cursor-pointer"
                  >
                    Xem tất cả
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Section 2: Danh sách các trạm ĐÃ THỰC HIỆN 5S */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
        {/* Filters & Search Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-vnpt-500" />
              <span>Danh sách trạm đã thực hiện 5S ({selectedMonth})</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {filteredStationStatuses.length} trạm
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Chỉ hiển thị các nhà trạm đã thực hiện khảo sát 5S trong {selectedMonth}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Tổ */}
            <select
              value={selectedOrgFilter}
              onChange={(e) => {
                setSelectedOrgFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-vnpt-500 cursor-pointer"
            >
              <option value="Tất cả">Tất cả các Tổ ({orgSummaries.length})</option>
              {orgSummaries.map((o) => (
                <option key={o.orgName} value={o.orgName}>
                  {o.orgName} ({o.performedCount}/{o.targetStations} trạm)
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-vnpt-500 cursor-pointer"
            >
              <option value="all">📷 Tất cả trạm đã thực hiện ({performed5SStatuses.length})</option>
              <option value="complete">✅ Đủ 2 ảnh Trước & Sau ({networkTotals.totalComplete})</option>
              <option value="before_only">⏳ Chỉ có ảnh Trước ({networkTotals.totalBeforeOnly})</option>
              <option value="after_only">📸 Chỉ có ảnh Sau ({networkTotals.totalAfterOnly})</option>
              <option value="partial">⚠️ Thiếu 1 trong 2 ảnh ({networkTotals.totalPartial})</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-white shadow-xs text-vnpt-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Dạng bảng"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow-xs text-vnpt-600 font-bold' : 'text-slate-500 hover:text-slate-700'
                }`}
                title="Dạng lưới ảnh"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Tìm theo Mã nhà trạm, Tên trạm, NV quản lý, hoặc gõ viết tắt (vd: tpo, 0215, nva)..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-vnpt-500"
          />
        </div>

        {/* Table View */}
        {viewMode === 'table' ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-3">Tổ Hạ tầng</th>
                  <th className="py-3 px-3">Mã & Tên nhà trạm</th>
                  <th className="py-3 px-3">NV quản lý trạm</th>
                  <th className="py-3 px-3">Ngày khảo sát</th>
                  <th className="py-3 px-3 text-center">Trạng thái ảnh</th>
                  <th className="py-3 px-3 text-center">Ảnh Trước</th>
                  <th className="py-3 px-3 text-center">Ảnh Sau</th>
                  <th className="py-3 px-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedStationStatuses.length > 0 ? (
                  paginatedStationStatuses.map((item, idx) => (
                    <tr key={item.station.ma_nha_tram} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-400">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700 whitespace-nowrap">
                        {item.station.to_ha_tang}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{item.station.ma_nha_tram}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{item.station.ten_nha_tram}</div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-700">{item.station.nguoi_phu_trach || 'Chưa phân công'}</div>
                        {item.station.ma_nv && (
                          <div className="text-[10px] font-mono text-slate-400 font-bold">{item.station.ma_nv}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-600">
                        {item.surveyDate || item.month}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.statusColor}`}>
                          {item.statusText}
                        </span>
                      </td>

                      {/* Ảnh Trước Thumbnail */}
                      <td className="py-2.5 px-3 text-center">
                        {item.beforePhotos.length > 0 ? (
                          <div
                            onClick={() => openLightboxForStation(item, 'before')}
                            className="inline-flex items-center gap-1.5 p-1 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg cursor-pointer transition-all hover:scale-105 group"
                            title="Bấm để xem phóng to ảnh Trước"
                          >
                            <img
                              src={item.beforePhotos[0]}
                              alt="Ảnh trước"
                              loading="lazy"
                              decoding="async"
                              className="w-10 h-10 object-cover rounded-md border border-slate-200"
                            />
                            <div className="text-left pr-1">
                              <span className="text-[10px] font-bold text-vnpt-700 group-hover:underline flex items-center gap-0.5">
                                <Eye className="w-3 h-3" /> {item.beforePhotos.length} ảnh
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold italic">Chưa có</span>
                        )}
                      </td>

                      {/* Ảnh Sau Thumbnail */}
                      <td className="py-2.5 px-3 text-center">
                        {item.afterPhotos.length > 0 ? (
                          <div
                            onClick={() => openLightboxForStation(item, 'after')}
                            className="inline-flex items-center gap-1.5 p-1 bg-slate-50 hover:bg-emerald-50 border border-slate-200 rounded-lg cursor-pointer transition-all hover:scale-105 group"
                            title="Bấm để xem phóng to ảnh Sau"
                          >
                            <img
                              src={item.afterPhotos[0]}
                              alt="Ảnh sau"
                              loading="lazy"
                              decoding="async"
                              className="w-10 h-10 object-cover rounded-md border border-slate-200"
                            />
                            <div className="text-left pr-1">
                              <span className="text-[10px] font-bold text-emerald-700 group-hover:underline flex items-center gap-0.5">
                                <Eye className="w-3 h-3" /> {item.afterPhotos.length} ảnh
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold italic">Chưa có</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigateToSurvey?.(item.record || ({ ma_nha_tram: item.station.ma_nha_tram } as any))}
                          className="px-2.5 py-1 bg-vnpt-50 hover:bg-vnpt-100 text-vnpt-700 rounded-lg font-bold text-[11px] border border-vnpt-200 transition-colors flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <span>Nộp/Sửa ảnh</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                      Chưa có nhà trạm nào thực hiện 5S trong {selectedMonth}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedStationStatuses.map((item) => (
              <div
                key={item.station.ma_nha_tram}
                className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 hover:border-vnpt-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-200 text-slate-700">
                      {item.station.to_ha_tang}
                    </span>
                    <h4 className="font-black text-slate-800 text-sm mt-1">{item.station.ma_nha_tram}</h4>
                    <p className="text-xs text-slate-500 truncate">{item.station.ten_nha_tram}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${item.statusColor}`}>
                    {item.statusText}
                  </span>
                </div>

                {/* Photo Previews */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div
                    onClick={() => item.beforePhotos.length > 0 && openLightboxForStation(item, 'before')}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      item.beforePhotos.length > 0
                        ? 'bg-white border-slate-200 hover:border-blue-300 cursor-pointer shadow-xs'
                        : 'bg-slate-100 border-dashed border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold text-blue-700 block mb-1">ẢNH TRƯỚC</span>
                    {item.beforePhotos.length > 0 ? (
                      <img
                        src={item.beforePhotos[0]}
                        alt="Trước"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-[10px] italic">
                        Chưa chụp
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => item.afterPhotos.length > 0 && openLightboxForStation(item, 'after')}
                    className={`rounded-xl border p-2 text-center transition-all ${
                      item.afterPhotos.length > 0
                        ? 'bg-white border-slate-200 hover:border-emerald-300 cursor-pointer shadow-xs'
                        : 'bg-slate-100 border-dashed border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold text-emerald-700 block mb-1">ẢNH SAU</span>
                    {item.afterPhotos.length > 0 ? (
                      <img
                        src={item.afterPhotos[0]}
                        alt="Sau"
                        loading="lazy"
                        decoding="async"
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-[10px] italic">
                        Chưa chụp
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                  <span className="text-slate-500 font-medium">
                    👤 {item.station.nguoi_phu_trach || 'Chưa rõ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToSurvey?.(item.record || ({ ma_nha_tram: item.station.ma_nha_tram } as any))}
                    className="px-2.5 py-1 bg-vnpt-600 hover:bg-vnpt-700 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    Cập nhật
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Thanh phân trang Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
            <div className="text-slate-500 font-semibold">
              Hiển thị <strong className="text-slate-800">{(currentPage - 1) * pageSize + 1}</strong> -{' '}
              <strong className="text-slate-800">
                {Math.min(currentPage * pageSize, filteredStationStatuses.length)}
              </strong>{' '}
              trong tổng số <strong className="text-vnpt-700">{filteredStationStatuses.length}</strong> trạm đã thực hiện trong {selectedMonth}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
              >
                Trang trước
              </button>

              <span className="px-3 py-1.5 bg-slate-50 rounded-lg font-bold text-slate-700 border border-slate-200">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-xs"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
