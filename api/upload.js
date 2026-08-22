/**
 * Vercel Serverless Function: Upload Image to Google Drive API & Return LH3 Link
 * Endpoint: POST /api/upload
 * 
 * Yêu cầu biến môi trường trên Vercel:
 * - GOOGLE_CLIENT_EMAIL: Email Service Account Google Cloud
 * - GOOGLE_PRIVATE_KEY: Private Key RSA của Service Account (hỗ trợ cả dạng escaped \n)
 * - GOOGLE_DRIVE_FOLDER_ID: ID thư mục Google Drive để lưu ảnh minh chứng 5S
 * - GOOGLE_SHEET_ID: (Tùy chọn) ID Google Sheet để ghi log vào sheet ANH_MINH_CHUNG
 */

const crypto = require('crypto');

// Cache Google OAuth2 Access Token
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Tạo Google OAuth2 Access Token từ Service Account Key sử dụng crypto tích hợp sẵn của Node.js
 */
async function getGoogleAccessToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && tokenExpiry > now + 60) {
    return cachedToken;
  }

  // Chuẩn hóa Private Key (xử lý dấu xuống dòng \n từ biến môi trường Vercel)
  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets',
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

module.exports = async function handler(req, res) {
  // Bật CORS Headers cho Vercel
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
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed. Use POST.' });
  }

  try {
    const {
      base64Data,
      fileName,
      mimeType = 'image/jpeg',
      folderId,
      stationCode = '',
      stationName = '',
      recordId = '',
      photoType = 'Sau' // 'Trước' | 'Sau'
    } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({ status: 'error', message: 'Thiếu dữ liệu ảnh (base64Data).' });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!clientEmail || !privateKey) {
      return res.status(500).json({
        status: 'error',
        message: 'Chưa cấu hình biến môi trường GOOGLE_CLIENT_EMAIL hoặc GOOGLE_PRIVATE_KEY trên Vercel.'
      });
    }

    // 1. Lấy Google Access Token
    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    // 2. Chuyển đổi Base64 sang Buffer
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const finalFileName = fileName || `5S_${stationCode || 'TRAM'}_${photoType}_${Date.now()}.jpg`;

    // 3. Chuẩn bị Multipart Upload lên Google Drive API v3
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: finalFileName,
      mimeType: mimeType
    };
    if (targetFolderId) {
      metadata.parents = [targetFolderId];
    }

    const multipartRequestBody = Buffer.concat([
      Buffer.from(
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${mimeType}\r\n` +
        'Content-Transfer-Encoding: base64\r\n\r\n'
      ),
      Buffer.from(cleanBase64),
      Buffer.from(closeDelimiter)
    ]);

    const driveUploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      }
    );

    const driveData = await driveUploadRes.json();
    if (!driveUploadRes.ok || !driveData.id) {
      throw new Error(`Upload Drive Thất bại: ${driveData.error?.message || JSON.stringify(driveData)}`);
    }

    const fileId = driveData.id;

    // 4. Phân quyền File sang "Anyone with link can view" (reader) để link LH3 hoạt động công khai không bị lỗi
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('Lỗi phân quyền công khai file:', permErr);
    }

    // 5. GHÉP LINK LH3 CHUẨN GOOGLE USER CONTENT CDN
    const lh3Url = `https://lh3.googleusercontent.com/d/${fileId}`;

    // 6. (Tùy chọn) Tự động ghi nhận ảnh vào sheet ANH_MINH_CHUNG nếu có GOOGLE_SHEET_ID
    if (sheetId) {
      try {
        const photoRow = [
          `ANH_${Date.now().toString().slice(-6)}`,
          recordId || '',
          '',
          stationCode || '',
          photoType || 'Sau',
          'Minh chứng 5S',
          lh3Url, // Ghi chuẩn link lh3 vào sheet
          `Ảnh ${photoType} - ${stationName || stationCode}`,
          new Date().toISOString().split('T')[0],
          'WebApp 5S',
          new Date().toISOString()
        ];

        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/ANH_MINH_CHUNG!A:K:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              values: [photoRow]
            })
          }
        );
      } catch (sheetErr) {
        console.warn('Không thể ghi ảnh vào sheet ANH_MINH_CHUNG:', sheetErr);
      }
    }

    return res.status(200).json({
      status: 'success',
      message: 'Tải ảnh lên Google Drive và tạo link LH3 thành công!',
      data: {
        fileId: fileId,
        fileName: finalFileName,
        lh3Url: lh3Url,
        driveViewLink: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`
      }
    });

  } catch (error) {
    console.error('API /api/upload error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Lỗi xử lý tải ảnh lên Google Drive'
    });
  }
};
