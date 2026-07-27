# 🏢 NHÀ TRẠM 5S - WEB APP & DASHBOARD ĐIỀU HÀNH
> **VNPT TRUNG TÂM HẠ TẦNG PHÚ THỌ**  
> Hệ thống theo dõi cải thiện điều kiện lao động, đánh giá 5S và kết nối Google Sheets thời gian thực qua Apps Script.

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Dashboard Điều hành (Giao diện 1:1 theo mẫu Image 2)**:
   - **5 Card KPI**: Nhà trạm kế hoạch (120), Đã khảo sát (82), Đã hoàn thành 5S (64), Tỷ lệ đạt chuẩn (84.4%), Điểm cải thiện bình quân (+19.4).
   - **Biểu đồ Cột**: So sánh điểm trước - sau theo Tổ Hạ tầng (Phú Thọ, Vĩnh Yên, Hòa Bình, Việt Trì, Lương Sơn).
   - **Biểu đồ Donut**: Phân bổ tình trạng kiến nghị (Đã hoàn thành 78, Đang xử lý 12, Quá hạn 6).
   - **Danh sách Ưu tiên**: Bảng đôn đốc các nhà trạm tái kiểm tra theo hạn dùng màu cảnh báo (Đúng hạn, Sắp đến hạn, Quá hạn).

2. **Phiếu Khảo sát & Đánh giá 5S (Giao diện 1:1 theo mẫu Image 1)**:
   - **Thông tin nhà trạm**: Mã nhà trạm (TPO-0215,...), Tên nhà trạm, Tổ Hạ tầng, Ngày khảo sát.
   - **Chấm điểm 5S tương tác**: S1 Sàng lọc (20), S2 Sắp xếp (20), S3 Sạch sẽ (25), S4 Săn sóc (20), S5 Sẵn sàng (15). *Tự động tính tổng điểm tối đa 100*.
   - **Nguy cơ / Kiến nghị phát hiện**: Ô cảnh báo ưu tiên, đầu mối xử lý.
   - **Đính kèm ảnh minh chứng**: Nút chụp/tải ảnh (+ Ảnh hiện trạng, + Ảnh sau cải thiện).
   - **Cột kết quả tự động**: Tính điểm sau, xếp loại (ĐẠT, TIÊU BIỂU, CẦN CẢI THIỆN), thanh so sánh trước-sau, và khung mô phỏng Mobile QR code cập nhật tại hiện trường.

3. **Tích hợp Google Sheets qua Google Apps Script (`Code.gs`)**:
   - Chạy trực tiếp trên Google Sheets (không tốn chi phí server).
   - Tự động khởi tạo các Sheet chuẩn dữ liệu: `DM_NHA_TRAM`, `HOSO_5S`, `LICH_SU_5S`, `KIEN_NGHI`, `ANH_MINH_CHUNG`, `NGUOI_DUNG`.
   - Hỗ trợ xem Demo Local hoặc kết nối Live Data.

---

## 🚀 HƯỚNG DẪN ĐẨY LÊN GITHUB & VERCEL

### 1. Đẩy Code Lên GitHub (`https://github.com/ttkdvp-prog/nhatram5s`)
Mở PowerShell tại thư mục dự án và chạy các lệnh sau:

```bash
# 1. Khởi tạo kho chứa Git (nếu chưa khởi tạo)
git init

# 2. Thêm tất cả các file
git add .

# 3. Commit phiên bản đầu tiên
git commit -m "Feat: Complete 5S Nha Tram WebApp Dashboard & AppsScript Backend"

# 4. Tạo nhánh main
git branch -M main

# 5. Thêm remote repository GitHub của bạn
git remote add origin https://github.com/ttkdvp-prog/nhatram5s.git

# 6. Đẩy mã nguồn lên GitHub
git push -u origin main --force
```

---

### 2. Triển Khai Web App Lên Vercel (Miễn Phí)

1. Truy cập [Vercel.com](https://vercel.com) và đăng nhập bằng tài khoản GitHub.
2. Nhấn **Add New Project** -> Chọn Repository `ttkdvp-prog/nhatram5s`.
3. Cấu hình triển khai:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Nhấn **Deploy**. Vercel sẽ tự động build và cấp cho bạn đường dẫn URL (ví dụ: `https://nhatram5s.vercel.app`).

---

### 3. Cài Đặt Google Apps Script Cho Google Sheet

1. Mở một Google Sheet mới trên Google Drive của bạn (hoặc mở Google Sheet mẫu).
2. Vào menu **Tiện ích mở rộng (Extensions)** -> Chọn **Apps Script**.
3. Xóa hết mã có sẵn trong file `Code.gs`.
4. Mở file `google_apps_script/Code.gs` trong dự án này, copy toàn bộ nội dung và dán vào Apps Script.
5. Nhấn **Triển khai (Deploy)** -> **Triển khai dưới dạng ứng dụng web (New deployment -> Web app)**.
6. Thiết lập cấu hình:
   - **Mô tả (Description)**: `Backend WebApp Nhà Trạm 5S`
   - **Thực thi dưới dạng (Execute as)**: `Tôi (Me)`
   - **Ai có quyền truy cập (Who has access)**: `Bất kỳ ai (Anyone)` *(Rất quan trọng để WebApp gửi/nhận dữ liệu không bị chặn CORS)*
7. Nhấn **Triển khai**, cấp quyền truy cập tài khoản Google nếu được hỏi.
8. Copy **URL Web App** nhận được (có dạng `https://script.google.com/macros/s/AKfycb.../exec`).
9. Mở Web App trên trình duyệt -> Nhấn nút **Cấu hình kết nối (biểu tượng Bánh răng/Database)** ở góc trên bên phải -> Dán URL Web App vào -> Nhấn **Lưu cấu hình**.

---

## 🛠️ PHÁT TRIỂN CỤC BỘ (LOCAL DEVELOPMENT)

```bash
# Cài đặt thư viện
npm install

# Khởi chạy dev server
npm run dev

# Kiểm tra build sản phẩm
npm run build
```
