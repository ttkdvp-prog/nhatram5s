import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface CertificateGuess {
  loai: 'kiem_dinh' | 'cong_bo';
  so_giay: string;
  ngay_bat_dau: string; // dd/MM/yyyy
  ngay_het_han: string; // dd/MM/yyyy
  method: 'text' | 'ocr' | 'none';
  rawLength: number;
}

const pad = (n: number | string) => String(n).padStart(2, '0');

/** Đọc văn bản trực tiếp từ PDF (không OCR). */
const extractText = async (doc: pdfjs.PDFDocumentProxy, maxPages = 3): Promise<string> => {
  let out = '';
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  return out;
};

/** OCR trang đầu khi PDF là ảnh quét. Tesseract tải dữ liệu tiếng Việt từ CDN ở lần đầu dùng. */
const ocrText = async (doc: pdfjs.PDFDocumentProxy, maxPages = 2): Promise<string> => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('vie');
  try {
    let out = '';
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      const { data } = await worker.recognize(canvas);
      out += data.text + '\n';
    }
    return out;
  } finally {
    await worker.terminate();
  }
};

const DATE_RE = /(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{4})|ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/gi;

const toDmy = (m: RegExpMatchArray): string => {
  const d = m[1] || m[4];
  const mo = m[2] || m[5];
  const y = m[3] || m[6];
  return `${pad(d)}/${pad(mo)}/${y}`;
};

const validDmy = (s: string) => {
  const [d, m, y] = s.split('/').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && y >= 2000 && y <= 2100;
};

const dateAfter = (text: string, keyword: RegExp): string => {
  const m = keyword.exec(text);
  if (!m) return '';
  const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 80);
  DATE_RE.lastIndex = 0;
  const dm = DATE_RE.exec(tail);
  if (!dm) return '';
  const s = toDmy(dm);
  return validDmy(s) ? s : '';
};

/** Phân tích văn bản giấy để đoán số giấy và ngày. Kết quả chỉ để người dùng xác nhận/sửa. */
export const guessFromText = (text: string): Omit<CertificateGuess, 'method' | 'rawLength'> => {
  const t = text.replace(/\s+/g, ' ');
  const loai: 'kiem_dinh' | 'cong_bo' = /bản công bố|công bố hợp quy|giấy chứng nhận công bố/i.test(t) ? 'cong_bo' : 'kiem_dinh';

  let so_giay = '';
  const labeled = /Số\s*(?:giấy|GCN|chứng nhận)?[^:：\n]{0,20}[:：]\s*([A-Z0-9][A-Z0-9\/.\-]{5,})/i.exec(t);
  if (labeled) so_giay = labeled[1].replace(/[.,;]+$/, '');
  if (!so_giay) {
    const loose = /\b[A-Z]{1,3}\d{6,}[A-Z0-9]*\b/.exec(t);
    if (loose) so_giay = loose[0];
  }

  let start = dateAfter(t, /(ngày\s*(?:kiểm định|cấp|ký)|có hiệu lực từ|từ ngày)\s*[:：]?/i);
  let end = dateAfter(t, /(hết hạn(?:\s*ngày)?|có (?:giá trị|hiệu lực) (?:đến|tới)|hiệu lực đến|đến ngày)\s*[:：]?/i);

  if (!start || !end) {
    const all: string[] = [];
    DATE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = DATE_RE.exec(t))) {
      const s = toDmy(m);
      if (validDmy(s)) all.push(s);
    }
    const ts = (s: string) => {
      const [d, mo, y] = s.split('/').map(Number);
      return new Date(y, mo - 1, d).getTime();
    };
    const sorted = Array.from(new Set(all)).sort((a, b) => ts(a) - ts(b));
    if (!start && sorted.length >= 2) start = sorted[0];
    if (!end && sorted.length >= 2) end = sorted[sorted.length - 1];
  }
  return { loai, so_giay, ngay_bat_dau: start, ngay_het_han: end };
};

export const readCertificatePdf = async (
  file: File,
  onProgress?: (msg: string) => void
): Promise<CertificateGuess> => {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;

  onProgress?.('Đang đọc văn bản trong PDF...');
  let text = await extractText(doc);
  let method: CertificateGuess['method'] = 'text';

  if (text.replace(/\s/g, '').length < 40) {
    onProgress?.('PDF là ảnh quét, đang nhận dạng chữ (OCR), có thể mất vài chục giây...');
    try {
      text = await ocrText(doc);
      method = 'ocr';
    } catch {
      return { loai: 'kiem_dinh', so_giay: '', ngay_bat_dau: '', ngay_het_han: '', method: 'none', rawLength: 0 };
    }
  }
  const guess = guessFromText(text);
  return { ...guess, method, rawLength: text.length };
};
