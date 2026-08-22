import React from 'react';
import { LayoutDashboard, ClipboardCheck, FolderKanban, Camera, AlertTriangle, RefreshCw, BarChart3, Radio } from 'lucide-react';

export type ActiveTab = 'overview' | 'survey' | 'records' | 'photos' | 'recommendations' | 'reinspection' | 'reports';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile
}) => {
  const menuItems = [
    { id: 'overview' as ActiveTab, label: 'Tổng quan', icon: LayoutDashboard },
    { id: 'survey' as ActiveTab, label: 'Triển khai 5S', icon: ClipboardCheck },
    { id: 'records' as ActiveTab, label: 'Hồ sơ nhà trạm', icon: FolderKanban },
    { id: 'photos' as ActiveTab, label: 'Thống kê ảnh 5S', icon: Camera },
    { id: 'recommendations' as ActiveTab, label: 'Kiến nghị', icon: AlertTriangle },
    { id: 'reinspection' as ActiveTab, label: 'Tái kiểm tra', icon: RefreshCw },
    { id: 'reports' as ActiveTab, label: 'Báo cáo', icon: BarChart3 },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      <aside className={`fixed top-0 bottom-0 left-0 z-40 w-64 vnpt-gradient-sidebar text-white flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header Branding matching Image 1 & 2 */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
              <Radio className="w-6 h-6 text-sky-200 animate-pulse" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tight text-white leading-tight">NHÀ TRẠM 5S</h1>
              <p className="text-xs text-sky-200 font-medium tracking-wide">Trung tâm Hạ tầng</p>
            </div>
          </div>
        </div>

        {/* Navigation Menu matching Image 1 */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpenMobile(false);
                }}
                className={`w-full flex items-center space-x-3.5 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-vnpt-700 shadow-lg shadow-black/10 font-bold translate-x-1'
                    : 'text-sky-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-vnpt-600' : 'text-sky-200'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom User Profile Card matching Image 1 */}
        <div className="p-4 border-t border-white/10">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
            <h4 className="font-bold text-sm text-white">Tổ Hạ tầng Việt Trì</h4>
            <p className="text-xs text-sky-200 mt-0.5">Người cập nhật: <span className="font-semibold text-white">Nguyễn Văn A</span></p>
          </div>
        </div>
      </aside>
    </>
  );
};
