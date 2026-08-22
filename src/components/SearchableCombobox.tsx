import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
}

interface SearchableComboboxProps {
  label?: string;
  required?: boolean;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

// Hàm chuẩn hóa chuỗi tiếng Việt không dấu để tìm kiếm thông minh và viết tắt
export const normalizeSearch = (str: string): string => {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim();
};

export const matchesSearch = (text: string, subText: string | undefined, query: string): boolean => {
  if (!query.trim()) return true;
  const q = normalizeSearch(query);
  const target = normalizeSearch(text);
  const sub = normalizeSearch(subText || '');

  // 1. Khớp chuỗi trực tiếp (vd: 'viet tri' -> 'BTS Viet Tri')
  if (target.includes(q) || sub.includes(q)) return true;

  // 2. Khớp viết tắt chữ cái đầu (vd: 'nva' -> 'nguyen van a', 'bvt' -> 'bts viet tri')
  const words = (target + ' ' + sub).split(/\s+/).filter(Boolean);
  const initials = words.map(w => w[0]).join('');
  if (initials.includes(q.replace(/\s+/g, ''))) return true;

  // 3. Khớp từng từ khóa rời
  const queryTokens = q.split(/\s+/).filter(Boolean);
  return queryTokens.every(tok => target.includes(tok) || sub.includes(tok));
};

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  label,
  required,
  options,
  value,
  onChange,
  placeholder = 'Tìm kiếm hoặc chọn...',
  emptyText = 'Không tìm thấy kết quả phù hợp',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tìm option hiện tại được chọn
  const selectedOption = options.find(opt => opt.value === value);

  // Lọc options theo từ khóa tìm kiếm
  const filteredOptions = options.filter(opt =>
    matchesSearch(opt.label, opt.subLabel, searchQuery)
  );

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          {label} {required && <span className="text-vnpt-600 font-bold">*</span>}
        </label>
      )}

      {/* Trigger Button / Input Bar */}
      <div
        onClick={handleToggle}
        className={`w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/80 border ${
          isOpen ? 'border-vnpt-500 ring-2 ring-vnpt-500/20 bg-white' : 'border-slate-200'
        } rounded-xl text-sm transition-all flex items-center justify-between gap-2 cursor-pointer shadow-xs ${
          disabled ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''
        }`}
      >
        <div className="flex-1 truncate text-left">
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-slate-800 text-sm truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700">
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.subLabel && (
                <span className="text-xs text-slate-400 font-medium truncate">• {selectedOption.subLabel}</span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 text-sm">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-vnpt-600' : ''}`} />
        </div>
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gõ tên, mã, viết tắt (vd: nva, tpo, viettri)..."
              className="w-full bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-none placeholder-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1.5 divide-y divide-slate-50 space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full px-3 py-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-vnpt-50 text-vnpt-900 font-bold border border-vnpt-200'
                        : 'hover:bg-slate-100 text-slate-700 font-medium'
                    }`}
                  >
                    <div className="flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isSelected ? 'font-black text-vnpt-700' : 'font-bold text-slate-800'}`}>
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subLabel && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{opt.subLabel}</div>
                      )}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-vnpt-600 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 font-medium">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
