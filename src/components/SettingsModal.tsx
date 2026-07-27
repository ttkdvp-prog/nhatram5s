import React, { useState, useEffect } from 'react';
import { X, Check, Server, ExternalLink, RefreshCw } from 'lucide-react';
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
      setMessage('Vui lòng nhập URL Google Apps Script Web App');
      return;
    }
    setStatus('testing');
    setMessage('Đang kết nối thử nghiệm...');
    try {
      const res = await fetch(`${url.trim()}?action=getStats`);
      const data = await res.json();
      if (data.status === 'success') {
        setStatus('success');
        setMessage('Kết nối Google Sheets thành công!');
      } else {
        setStatus('error');
        setMessage('Kết nối không thành công. Hãy kiểm tra lại phân quyền Web App.');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Lỗi kết nối. Vui lòng đảm bảo Web App đã được triển khai chọn "Anyone".');
    }
  };

  const handleSave = () => {
    setAppScriptUrl(url);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-100">
        <div className="bg-vnpt-500 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Server className="w-6 h-6 text-sky-200" />
            <div>
              <h3 className="font-bold text-lg">Cấu hình kết nối Google Sheets (Apps Script)</h3>
              <p className="text-xs text-sky-100">Đồng bộ dữ liệu thời gian thực giữa Web App và Google Sheet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
            <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
              <ExternalLink className="w-4 h-4 text-blue-600" /> Cài đặt Google Apps Script:
            </p>
            1. Mở file <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">google_apps_script/Code.gs</code> trong dự án này.<br />
            2. Mở Google Sheet của bạn &gt; Tiện ích mở rộng &gt; Apps Script &gt; Dán mã.<br />
            3. Nhấn <strong>Triển khai (Deploy)</strong> &gt; <strong>Triển khai dưới dạng ứng dụng web</strong> &gt; Chọn quyền truy cập: <em>"Bất kỳ ai (Anyone)"</em>.<br />
            4. Copy URL Web App có đuôi <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">/exec</code> dán vào ô bên dưới.
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Google Apps Script Web App URL:
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-vnpt-500 focus:border-transparent text-sm font-mono text-slate-800"
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

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleTestConnection}
              disabled={status === 'testing'}
              className="px-4 py-2 text-xs font-semibold text-vnpt-600 bg-vnpt-50 hover:bg-vnpt-100 rounded-xl border border-vnpt-200 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'testing' ? 'animate-spin' : ''}`} />
              Kiểm tra kết nối
            </button>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 text-xs font-bold text-white bg-vnpt-500 hover:bg-vnpt-600 rounded-xl shadow-md transition-colors"
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
