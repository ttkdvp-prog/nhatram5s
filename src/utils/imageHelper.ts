/**
 * Tiện ích xử lý hình ảnh Google Drive & Định dạng Link LH3 (Google User Content CDN)
 * Nhà trạm 5S - VNPT Trung tâm Hạ tầng Phú Thọ
 */

/**
 * Trích xuất Google Drive File ID từ nhiều định dạng URL khác nhau hoặc raw ID.
 * Hỗ trợ các dạng link:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - https://drive.google.com/uc?id=FILE_ID
 * - https://drive.google.com/open?id=FILE_ID
 * - https://lh3.googleusercontent.com/d/FILE_ID
 * - https://lh3.googleusercontent.com/u/0/d/FILE_ID
 * - Raw ID: 1a2B3c4D5E... (chuỗi ký tự 25-45 ký tự)
 */
export const extractDriveFileId = (input: string): string | null => {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Dạng /file/d/FILE_ID
  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{25,})/);
  if (fileDMatch) return fileDMatch[1];

  // Dạng /d/FILE_ID (lh3.googleusercontent.com/d/FILE_ID)
  const lh3Match = trimmed.match(/googleusercontent\.com(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]{25,})/);
  if (lh3Match) return lh3Match[1];

  // Dạng ?id=FILE_ID hoặc &id=FILE_ID
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (idParamMatch) return idParamMatch[1];

  // Dạng /folders/FOLDER_ID (nếu có ai paste folder)
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{25,})/);
  if (folderMatch) return folderMatch[1];

  // Kiểm tra nếu chuỗi truyền vào trực tiếp là raw Google Drive File ID (25 - 45 ký tự alphanumeric)
  const isDirectId = /^[a-zA-Z0-9_-]{25,45}$/.test(trimmed);
  if (isDirectId) return trimmed;

  return null;
};

/**
 * Chuyển đổi bất kỳ link Google Drive hoặc file ID thành link LH3 CDN trực tiếp:
 * https://lh3.googleusercontent.com/d/{FILE_ID}
 * 
 * @param input Link Drive, link LH3 hoặc ID file
 * @param size Kích thước ảnh tối đa (tùy chọn, vd: 1200 để lấy ảnh nét hoặc 0 để lấy full gốc)
 */
export const toLh3Url = (input: string, size?: number): string => {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();

  // Nếu là base64 data URL hoặc link ảnh ngoài (Unsplash, imgur, blob,...), giữ nguyên
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const fileId = extractDriveFileId(trimmed);
  if (fileId) {
    const sizeParam = size !== undefined ? (size === 0 ? '=s0' : `=s${size}`) : '';
    return `https://lh3.googleusercontent.com/d/${fileId}${sizeParam}`;
  }

  // Nếu đã là link web hợp lệ khác (http://, https://), trả về link gốc
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return trimmed;
};

/**
 * Kiểm tra xem một chuỗi có phải là link Google Drive hoặc link LH3 hợp lệ hay không.
 */
export const isDriveOrLh3Url = (input: string): boolean => {
  if (!input) return false;
  return extractDriveFileId(input) !== null;
};

/**
 * Ghép danh sách URL ảnh thành một chuỗi duy nhất để lưu trữ vào ô Google Sheet
 * Hỗ trợ phân cách bằng dấu phẩy và dấu cách hoặc xuống dòng
 */
export const formatSheetPhotoUrls = (urls: string[]): string => {
  if (!Array.isArray(urls) || urls.length === 0) return '';
  return urls
    .map(url => toLh3Url(url))
    .filter(Boolean)
    .join(', ');
};

/**
 * Phân tích ô dữ liệu từ Google Sheet (chứa 1 hoặc nhiều link ảnh) thành mảng các link LH3 chuẩn
 */
export const parseSheetPhotoUrls = (cellValue?: string | string[]): string[] => {
  if (!cellValue) return [];
  if (Array.isArray(cellValue)) {
    return cellValue.map(url => toLh3Url(url)).filter(Boolean);
  }

  const trimmed = String(cellValue).trim();
  if (!trimmed) return [];

  // Tách theo dấu phẩy, chấm phẩy hoặc dòng mới
  const parts = trimmed.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean);
  return parts.map(url => toLh3Url(url)).filter(Boolean);
};
