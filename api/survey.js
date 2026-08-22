/**
 * Vercel Serverless Function: Lưu phiếu khảo sát 5S vào Google Sheets qua Sheets API
 * Endpoint: POST /api/survey
 * 
 * Đảm bảo mọi link ảnh đính kèm đều được chuẩn hóa về định dạng LH3 trước khi ghi vào Sheet
 */

const crypto = require('crypto');

let cachedToken = null;
let tokenExpiry = 0;

async function getGoogleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiry > now + 60) {
    return cachedToken;
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const base64UrlEncode = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const encodedHeader = base64UrlEncode(header);
  const encodedClaim = base64UrlEncode(claim);
  const signInput = `${encodedHeader}.${encodedClaim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signInput);
  const signature = signer.sign(formattedPrivateKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Google Auth Failed: ${data.error_description || data.error || response.statusText}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = now + (data.expires_in || 3600);
  return cachedToken;
}

// Chuyển đổi ID/link Drive sang LH3
function toLh3(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) return trimmed;

  const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{25,})/);
  if (fileDMatch) return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;

  const lh3Match = trimmed.match(/googleusercontent\.com(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]{25,})/);
  if (lh3Match) return `https://lh3.googleusercontent.com/d/${lh3Match[1]}`;

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (idParamMatch) return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;

  if (/^[a-zA-Z0-9_-]{25,45}$/.test(trimmed)) {
    return `https://lh3.googleusercontent.com/d/${trimmed}`;
  }

  return trimmed;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const surveyData = req.body?.data || req.body || {};
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey || !sheetId) {
      return res.status(500).json({
        status: 'error',
        message: 'Thiếu cấu hình GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY hoặc GOOGLE_SHEET_ID trên Vercel.'
      });
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    const totalBefore = (surveyData.s1_truoc || 0) + (surveyData.s2_truoc || 0) + (surveyData.s3_truoc || 0) + (surveyData.s4_truoc || 0) + (surveyData.s5_truoc || 0);
    const totalAfter = (surveyData.s1_sau || 0) + (surveyData.s2_sau || 0) + (surveyData.s3_sau || 0) + (surveyData.s4_sau || 0) + (surveyData.s5_sau || 0);

    let xepLoaiSau = 'Chưa đạt';
    if (totalAfter >= 90) xepLoaiSau = 'Tiêu biểu';
    else if (totalAfter >= 80) xepLoaiSau = 'Đạt yêu cầu';
    else if (totalAfter >= 70) xepLoaiSau = 'Cần cải thiện';

    // Chuẩn hóa link ảnh sang LH3
    const anhTruocList = Array.isArray(surveyData.anh_truoc_list) ? surveyData.anh_truoc_list.map(toLh3) : [];
    const anhSauList = Array.isArray(surveyData.anh_sau_list) ? surveyData.anh_sau_list.map(toLh3) : [];

    const anhTruocLh3 = anhTruocList.length > 0 ? anhTruocList.join(', ') : toLh3(surveyData.anh_truoc_url);
    const anhSauLh3 = anhSauList.length > 0 ? anhSauList.join(', ') : toLh3(surveyData.anh_sau_url);

    const recordId = surveyData.id_ho_so || `HS${Date.now().toString().slice(-4)}`;

    // Ghi vào sheet HOSO_5S
    const hosoRow = [
      recordId,
      surveyData.id_nha_tram || '',
      surveyData.ma_nha_tram || '',
      surveyData.ten_nha_tram || '',
      surveyData.to_ha_tang || '',
      surveyData.ngay_khao_sat || new Date().toISOString().split('T')[0],
      surveyData.dot_danh_gia || 'Sau cải thiện',
      surveyData.nguoi_khao_sat || 'Nguyễn Văn A',
      surveyData.email_nguoi_khao_sat || 'viettri.5s@vnpt.vn',
      surveyData.s1_truoc || 0,
      surveyData.s2_truoc || 0,
      surveyData.s3_truoc || 0,
      surveyData.s4_truoc || 0,
      surveyData.s5_truoc || 0,
      totalBefore,
      surveyData.s1_sau || 0,
      surveyData.s2_sau || 0,
      surveyData.s3_sau || 0,
      surveyData.s4_sau || 0,
      surveyData.s5_sau || 0,
      totalAfter,
      totalAfter - totalBefore,
      surveyData.xep_loai_truoc || 'Chưa đạt',
      xepLoaiSau,
      surveyData.nguy_co_nghiem_trong || (surveyData.noi_dung_kien_nghi ? 'Có' : 'Không'),
      'Có',
      surveyData.noi_dung_thuc_hien || 'Hoàn thành khảo sát 5S',
      anhTruocLh3, // Ghi link LH3 vào sheet
      anhSauLh3,  // Ghi link LH3 vào sheet
      new Date().toISOString().split('T')[0],
      surveyData.ngay_tai_kiem_tra || '',
      'Hoàn thành',
      'Đúng hạn'
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/HOSO_5S!A:AF:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [hosoRow] })
      }
    );

    // Ghi vào sheet KIEN_NGHI nếu có kiến nghị
    if (surveyData.noi_dung_kien_nghi) {
      const recId = `KN${Date.now().toString().slice(-4)}`;
      const recRow = [
        recId,
        recordId,
        surveyData.id_nha_tram || '',
        surveyData.ma_nha_tram || '',
        surveyData.to_ha_tang || '',
        surveyData.ngay_khao_sat || new Date().toISOString().split('T')[0],
        surveyData.loai_nguy_co || 'Thực bì - nguy cơ cháy',
        surveyData.muc_uu_tien || 'Cao',
        surveyData.noi_dung_kien_nghi,
        surveyData.pham_vi_xu_ly || 'Chuyển chuyên môn',
        surveyData.dau_moi_xu_ly || surveyData.to_ha_tang || 'Bộ phận chuyên môn',
        surveyData.han_xu_ly || surveyData.ngay_tai_kiem_tra || '',
        'Mới tạo',
        '',
        anhTruocLh3,
        anhSauLh3,
        'Không',
        0,
        surveyData.email_nguoi_khao_sat || 'viettri.5s@vnpt.vn'
      ];

      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/KIEN_NGHI!A:S:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values: [recRow] })
        }
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Ghi phiếu khảo sát 5S và liên kết LH3 vào Google Sheets thành công!',
      recordId: recordId,
      anhTruocLh3: anhTruocLh3,
      anhSauLh3: anhSauLh3
    });

  } catch (error) {
    console.error('API /api/survey error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Lỗi lưu phiếu khảo sát vào Google Sheets'
    });
  }
};
