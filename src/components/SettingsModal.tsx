import React, { useState, useEffect } from 'react';
import { X, Check, Server, ExternalLink, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { getAppScriptUrl, setAppScriptUrl } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl(getAppScriptUrl());
      setStatus('idle');
      setMessage('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!url) {
      setStatus('error');
      setMessage('Vui lòng nhập URL Web App Google Apps Script');
      return;
    }
    setStatus('testing');
    setMessage('Đang kết nối thử nghiệm tới Google Apps Script...');
    try {
      const res = await fetch(`${url.trim()}?action=getStats`);
      const data = await res.json();
      if (data.status === 'success') {
        setStatus('success');
        setMessage('Kết nối Google Sheets & Google Drive (Code.gs) thành công!');
      } else {
        setStatus('error');
        setMessage('Kết nối không thành công. Hãy kiểm tra lại quyền Web App (Bất kỳ ai / Anyone).');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Lỗi kết nối. Vui lòng kiểm tra lại địa chỉ Web App API.');
    }
  };

  const handleSave = () => {
    setAppScriptUrl(url);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-vnpt-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Server className="w-6 h-6 text-sky-200" />
            <div>
              <h3 className="font-bold text-lg">Cấu hình kết nối Backend (Code.gs)</h3>
              <p className="text-xs text-sky-100">1 Biến API duy nhất kết nối Google Sheets & Google Drive</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 leading-relaxed space-y-1.5">
            <p className="font-bold text-blue-900 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-blue-600" /> Hướng dẫn 1-Click triển khai Apps Script:
            </p>
            <div>1. Mở Google Sheet quản lý 5S &rarr; <em>Tiện ích mở rộng</em> &rarr; <em>Apps Script</em>.</div>
            <div>2. Dán toàn bộ mã nguồn file <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-800 font-bold">google_apps_script/Code.gs</code>.</div>
            <div>3. Nhấn <strong>Triển khai (Deploy)</strong> &rarr; <strong>Ứng dụng web mới</strong> với quyền <em>"Bất kỳ ai (Anyone)"</em>.</div>
            <div>4. Dán URL Web App nhận được vào ô bên dưới.</div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-3 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Toàn bộ dữ liệu và tải ảnh Google Drive đều được tự động xử lý trọn gói bởi Code.gs!</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Địa chỉ Google Apps Script API URL (<code className="font-mono text-vnpt-700">VITE_APPSCRIPT_URL</code>):
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-vnpt-500 text-xs font-mono text-slate-800"
            />
          </div>

          {status !== 'idle' && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center space-x-2 ${
              status === 'testing' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
              status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {status === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />}
              {status === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
              <span>{message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={status === 'testing'}
              className="px-4 py-2 text-xs font-semibold text-vnpt-600 bg-vnpt-50 hover:bg-vnpt-100 rounded-xl border border-vnpt-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'testing' ? 'animate-spin' : ''}`} />
              <span>Kiểm tra kết nối</span>
            </button>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 text-xs font-bold text-white bg-vnpt-500 hover:bg-vnpt-600 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
