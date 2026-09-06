import React from 'react';
import { LayoutDashboard, ClipboardCheck, FolderKanban, Camera, BarChart3 } from 'lucide-react';
import { ActiveTab } from './Sidebar';

interface BottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

const navItems = [
  { id: 'overview' as ActiveTab, label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'survey' as ActiveTab, label: 'Triển khai', icon: ClipboardCheck },
  { id: 'records' as ActiveTab, label: 'Hồ sơ', icon: FolderKanban },
  { id: 'photos' as ActiveTab, label: 'Ảnh 5S', icon: Camera },
  { id: 'reports' as ActiveTab, label: 'Báo cáo', icon: BarChart3 },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-between px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0 select-none active:scale-95 transition-transform"
            >
              <Icon
                className={`w-5.5 h-5.5 transition-colors ${isActive ? 'text-vnpt-600' : 'text-slate-400'}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[10.5px] leading-none truncate max-w-full font-semibold ${
                  isActive ? 'text-vnpt-600' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
