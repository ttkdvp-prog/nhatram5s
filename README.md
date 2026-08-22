# 🏢 NHÀ TRẠM 5S - WEB APP & DASHBOARD ĐIỀU HÀNH
> **VNPT TRUNG TÂM HẠ TẦNG PHÚ THỌ**  
> Hệ thống theo dõi cải thiện điều kiện lao động, đánh giá 5S và kết nối Google Sheets & Google Drive thời gian thực với **Backend duy nhất qua `Code.gs` (Apps Script API)**.

---

## 🌟 ĐIỂM NỔI BẬT

1. **Toàn bộ Backend xử lý trọn gói trong 1 file `Code.gs`**:
   - Tự động lưu và quản lý dữ liệu trên Google Sheets (`DM_NHA_TRAM`, `HOSO_5S`, `LICH_SU_5S`, `KIEN_NGHI`, `ANH_MINH_CHUNG`).
   - Tự động upload ảnh lên thư mục Google Drive `NHATRAM_5S_MINH_CHUNG`.
   - Phân quyền công khai và ghép link ảnh thành định dạng **LH3 CDN Google**:
     $$\text{https://lh3.googleusercontent.com/d/}\{\text{FILE\_ID}\}$$
   - Hiển thị ảnh tức thì, 100% không bị chặn CORS hay lỗi nhúng ảnh.

2. **Chỉ cần 1 biến cấu hình duy nhất (`VITE_APPSCRIPT_URL`)**:
   - Không cần tạo Google Cloud Service Account, không cần Private Key phức tạp.
   - Chỉ cần copy mã vào Apps Script, nhấn Deploy Web App và dán 1 link URL là hệ thống hoạt động hoàn hảo!

---

## 🚀 HƯỚNG DẪN 1-CLICK TRIỂN KHAI BACKEND GOOGLE APPS SCRIPT

1. Mở một Google Sheet quản lý 5S trên Google Drive của bạn (hoặc mở Google Sheet mẫu).
2. Vào menu **Tiện ích mở rộng (Extensions)** &rarr; Chọn **Apps Script**.
3. Xóa hết mã có sẵn trong file `Code.gs`.
4. Mở file [`google_apps_script/Code.gs`](file:///d:/OneDrive%20-%20VNPT/AI/5nhatram5s/google_apps_script/Code.gs) trong dự án này, copy toàn bộ nội dung và dán vào Apps Script.
5. Nhấn **Triển khai (Deploy)** &rarr; **Triển khai dưới dạng ứng dụng web mới (New deployment -> Web app)**:
   - **Mô tả (Description)**: `Backend WebApp Nhà Trạm 5S`
   - **Thực thi dưới dạng (Execute as)**: `Tôi (Me)`
   - **Ai có quyền truy cập (Who has access)**: `Bất kỳ ai (Anyone)` *(Bắt buộc để WebApp gửi/nhận dữ liệu trực tiếp)*
6. Nhấn **Triển khai**, cấp quyền tài khoản Google.
7. Copy **URL Web App** nhận được (có dạng `https://script.google.com/macros/s/AKfycb.../exec`).
8. Cấu hình biến:
   - **Khi chạy trên Vercel**: Thêm 1 biến môi trường duy nhất trong Vercel Settings: `VITE_APPSCRIPT_URL = https://script.google.com/macros/s/.../exec`.
   - **Hoặc trên giao diện WebApp**: Nhấn nút **Cấu hình kết nối** (biểu tượng máy chủ góc phải) &rarr; Dán URL vào &rarr; Nhấn **Lưu cấu hình**.

---

## 💻 PHÁT TRIỂN & BUILD DỰ ÁN

```bash
# Cài đặt thư viện
npm install

# Khởi chạy dev server
npm run dev

# Kiểm tra build sản phẩm
npm run build
```
