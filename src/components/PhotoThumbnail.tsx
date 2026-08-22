import React, { useState } from 'react';
import { Eye, ExternalLink, ImageOff } from 'lucide-react';
import { extractDriveFileId, toLh3Url } from '../utils/imageHelper';
import { ImageLightbox, LightboxPhoto } from './ImageLightbox';

interface PhotoThumbnailProps {
  url?: string;
  urls?: string[];
  alt?: string;
  title?: string;
  stationCode?: string;
  type?: 'Trước' | 'Sau' | 'Nguy cơ' | 'Minh chứng';
  className?: string;
  aspectRatio?: 'square' | 'video' | 'auto';
  showCountBadge?: boolean;
}

export const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({
  url,
  urls,
  alt = '5S Minh chứng',
  title,
  stationCode,
  type,
  className = 'w-16 h-16 rounded-xl',
  aspectRatio = 'square',
  showCountBadge = true
}) => {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Tập hợp danh sách URLs
  const allUrls: string[] = (urls && urls.length > 0 ? urls : url ? [url] : []).map(toLh3Url).filter(Boolean);
  const primaryUrl = allUrls[0] || '';

  if (!primaryUrl) {
    return (
      <div className={`bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium p-1 ${className}`}>
        <ImageOff className="w-4 h-4 mb-0.5 opacity-60" />
        <span>Chưa có ảnh</span>
      </div>
    );
  }

  const fileId = extractDriveFileId(primaryUrl);
  const driveFallbackUrl = fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` : primaryUrl;

  const lightboxPhotos: LightboxPhoto[] = allUrls.map((u, idx) => ({
    url: u,
    title: title || `${type || 'Minh chứng'} 5S #${idx + 1}`,
    stationCode: stationCode,
    type: type
  }));

  const handleOpen = (e: React.MouseEvent, index = 0) => {
    e.stopPropagation();
    setSelectedIndex(index);
    setIsLightboxOpen(true);
  };

  return (
    <>
      <div
        onClick={(e) => handleOpen(e, 0)}
        className={`group relative overflow-hidden bg-slate-200 border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer ${className} ${
          aspectRatio === 'video' ? 'aspect-video' : aspectRatio === 'square' ? 'aspect-square' : ''
        }`}
      >
        {/* Loading shimmer */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 animate-pulse flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-vnpt-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Thumbnail Image */}
        {hasError ? (
          <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-2 text-center text-slate-500">
            <ExternalLink className="w-4 h-4 text-vnpt-500 mb-1" />
            <span className="text-[10px] font-bold text-vnpt-700">Xem ảnh Drive</span>
          </div>
        ) : (
          <img
            src={primaryUrl}
            alt={alt}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onLoad={() => setIsLoading(false)}
            onError={(e) => {
              // Thử fallback sang Google Drive thumbnail API nếu link LH3 gốc chưa kịp đồng bộ
              if (fileId && (e.currentTarget.src !== driveFallbackUrl)) {
                e.currentTarget.src = driveFallbackUrl;
              } else {
                setIsLoading(false);
                setHasError(true);
              }
            }}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white">
          <Eye className="w-4 h-4 text-white drop-shadow-md" />
        </div>

        {/* Badge số lượng ảnh nếu có nhiều hơn 1 */}
        {showCountBadge && allUrls.length > 1 && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white rounded-md text-[10px] font-black tracking-tight shadow-sm">
            +{allUrls.length}
          </div>
        )}

        {/* Badge Loại ảnh (Trước / Sau) */}
        {type && (
          <div
            className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white shadow-xs ${
              type === 'Trước' ? 'bg-rose-500/90' : type === 'Sau' ? 'bg-emerald-500/90' : 'bg-amber-500/90'
            }`}
          >
            {type}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <ImageLightbox
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        photos={lightboxPhotos}
        initialIndex={selectedIndex}
      />
    </>
  );
};
