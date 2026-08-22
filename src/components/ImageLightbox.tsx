import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, ExternalLink, Copy, Check, Eye } from 'lucide-react';
import { extractDriveFileId, toLh3Url } from '../utils/imageHelper';

export interface LightboxPhoto {
  url: string;
  title?: string;
  description?: string;
  stationCode?: string;
  type?: 'Trước' | 'Sau' | 'Nguy cơ' | 'Minh chứng';
}

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  photos: (string | LightboxPhoto)[];
  initialIndex?: number;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  isOpen,
  onClose,
  photos,
  initialIndex = 0
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgSrc, setImgSrc] = useState('');

  // Chuẩn hóa danh sách ảnh
  const normalizedPhotos: LightboxPhoto[] = photos.map((p, idx) => {
    if (typeof p === 'string') {
      return {
        url: toLh3Url(p),
        title: `Ảnh minh chứng #${idx + 1}`
      };
    }
    return {
      ...p,
      url: toLh3Url(p.url),
      title: p.title || `Ảnh minh chứng #${idx + 1}`
    };
  });

  const currentPhoto = normalizedPhotos[currentIndex] || { url: '', title: '' };

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, normalizedPhotos.length - 1)));
      setZoom(1);
      setRotation(0);
      setIsLoading(true);
      setHasError(false);
    }
  }, [isOpen, initialIndex, photos.length]);

  useEffect(() => {
    if (!currentPhoto.url) return;
    setIsLoading(true);
    setHasError(false);
    setZoom(1);
    setRotation(0);
    setImgSrc(currentPhoto.url);
  }, [currentIndex, currentPhoto.url]);

  const handleNext = useCallback(() => {
    if (normalizedPhotos.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % normalizedPhotos.length);
  }, [normalizedPhotos.length]);

  const handlePrev = useCallback(() => {
    if (normalizedPhotos.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + normalizedPhotos.length) % normalizedPhotos.length);
  }, [normalizedPhotos.length]);

  // Phím tắt bàn phím (Esc, Left, Right, +/-)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, z + 0.25));
      if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || normalizedPhotos.length === 0) return null;

  const fileId = extractDriveFileId(currentPhoto.url);
  const driveViewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view?usp=sharing` : currentPhoto.url;

  const handleImageError = () => {
    // Nếu link LH3 lỗi, thử fallback sang thumbnail API của Google Drive
    if (fileId && !imgSrc.includes('drive.google.com/thumbnail')) {
      setImgSrc(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`);
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    setHasError(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentPhoto.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentPhoto.url;
    link.download = `5S_${currentPhoto.stationCode || 'photo'}_${currentIndex + 1}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Controls Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 text-white">
        <div className="flex items-center space-x-3">
          {currentPhoto.type && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                currentPhoto.type === 'Trước'
                  ? 'bg-rose-500 text-white'
                  : currentPhoto.type === 'Sau'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {currentPhoto.type} 5S
            </span>
          )}
          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              {currentPhoto.stationCode && <span className="text-sky-400">[{currentPhoto.stationCode}]</span>}
              <span>{currentPhoto.title || 'Xem ảnh phóng to'}</span>
            </h4>
            {normalizedPhotos.length > 1 && (
              <p className="text-[11px] text-slate-400">
                Ảnh {currentIndex + 1} trên tổng số {normalizedPhotos.length}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 space-x-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
              className="p-1.5 hover:bg-white/20 rounded-lg text-slate-200 hover:text-white transition-colors"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono px-1.5 text-slate-300">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
              className="p-1.5 hover:bg-white/20 rounded-lg text-slate-200 hover:text-white transition-colors"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 hover:bg-white/20 rounded-lg text-slate-200 hover:text-white transition-colors"
              title="Xoay ảnh"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCopyLink}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-xs font-medium text-slate-200 hover:text-white transition-colors flex items-center gap-1.5 border border-white/10"
            title="Sao chép link ảnh"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{copied ? 'Đã chép link' : 'Copy link ảnh'}</span>
          </button>

          {fileId && (
            <a
              href={driveViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-sky-600/80 hover:bg-sky-600 backdrop-blur-md rounded-xl text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
              title="Mở trên Google Drive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Google Drive</span>
            </a>
          )}

          <button
            onClick={handleDownload}
            className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl text-slate-200 hover:text-white transition-colors border border-white/10"
            title="Tải ảnh về máy"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 bg-rose-600/80 hover:bg-rose-600 rounded-xl text-white transition-colors ml-2"
            title="Đóng (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12 overflow-hidden">
        {/* Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <div className="w-12 h-12 border-4 border-sky-400/30 border-t-sky-400 rounded-full animate-spin"></div>
            <p className="text-xs text-sky-200 font-medium">Đang tải hình ảnh từ Google CDN...</p>
          </div>
        )}

        {/* Error State */}
        {hasError ? (
          <div className="bg-slate-900/90 border border-slate-700 p-8 rounded-3xl text-center max-w-md space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Eye className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h5 className="font-bold text-white text-base">Không thể tải trực tiếp ảnh</h5>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tệp trên Google Drive có thể đang ở chế độ riêng tư hoặc link tạm thời không phản hồi.
              </p>
            </div>
            {fileId && (
              <a
                href={driveViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-vnpt-500 hover:bg-vnpt-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Mở ảnh trực tiếp trên Google Drive</span>
              </a>
            )}
          </div>
        ) : (
          <img
            src={imgSrc}
            alt={currentPhoto.title || '5S Photo'}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => setIsLoading(false)}
            onError={handleImageError}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.2s ease-out'
            }}
            className={`max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}

        {/* Navigation Arrow Left */}
        {normalizedPhotos.length > 1 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3.5 bg-black/50 hover:bg-black/80 text-white rounded-2xl backdrop-blur-md border border-white/10 transition-all hover:scale-110 z-20 cursor-pointer"
            title="Ảnh trước (Mũi tên trái)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Navigation Arrow Right */}
        {normalizedPhotos.length > 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3.5 bg-black/50 hover:bg-black/80 text-white rounded-2xl backdrop-blur-md border border-white/10 transition-all hover:scale-110 z-20 cursor-pointer"
            title="Ảnh tiếp theo (Mũi tên phải)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip (nếu có nhiều hơn 1 ảnh) */}
      {normalizedPhotos.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-center gap-2 z-20 overflow-x-auto">
          {normalizedPhotos.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                idx === currentIndex
                  ? 'border-sky-400 scale-110 shadow-lg ring-2 ring-sky-400/40'
                  : 'border-white/20 opacity-60 hover:opacity-100 hover:border-white/60'
              }`}
            >
              <img
                src={p.url}
                alt={`Thumb ${idx + 1}`}
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
