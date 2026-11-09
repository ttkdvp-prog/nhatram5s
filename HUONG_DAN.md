# HƯỚNG DẪN SỬ DỤNG VÀ QUẢN TRỊ – NHÀ TRẠM (VNPT Phú Thọ)

## 1. Đăng nhập

- **Tên đăng nhập**: phần trước `@` của email VNPT (ví dụ `cuongnv.vpc@vnpt.vn` → `cuongnv.vpc`).
- **Mật khẩu mặc định**: `1` (chỉ dùng được khi tài khoản chưa từng đổi mật khẩu).
- Lần đăng nhập đầu, hệ thống cho **chọn đổi mật khẩu** (tối thiểu 6 ký tự, không được là `1`) hoặc **giữ nguyên**. Nếu giữ nguyên, trên màn hình vẫn hiện cảnh báo vàng.
- Đổi mật khẩu bất cứ lúc nào: thẻ người dùng ở cuối thanh menu → **Đổi mật khẩu**.
- Sai mật khẩu 5 lần liên tiếp → khóa tài khoản 15 phút. Phiên đăng nhập hết hạn sau 6 giờ.

### Phân quyền

| Vai trò (cột `VaiTro`) | Thấy và cập nhật |
|---|---|
| `nhanvien` | Chỉ trạm có `ma_nv` trùng `MaNV` của mình |
| `totruong` | Toàn bộ trạm và nhân viên của Tổ mình (cột `To`) |
| `admin` | Tất cả; quản lý quy tắc nhắc việc, quét minh chứng, đặt lại mật khẩu |

Phân quyền kiểm tra ngay trong Apps Script (không chỉ ở giao diện).

## 2. Quản lý người dùng (sheet `NguoiDung`)

Cột: `TenDangNhap | MaNV | TenNV | To | ChucDanh | Email | VaiTro | MatKhauHash | MatKhau` (+ `DaXacNhanMK`, `NgayDoiMK` tự tạo).

- **Thêm người dùng**: thêm một dòng mới, điền `TenDangNhap`, `MaNV`, `TenNV`, `To`, `Email`, `VaiTro`. **Để trống** `MatKhauHash` và `MatKhau`.
- **Đặt lại mật khẩu**: xóa ô `MatKhauHash` và `DaXacNhanMK` của người đó (tài khoản quay về mật khẩu mặc định `1`). Cột `MatKhau` không dùng, luôn để trống.
- `MatKhauHash` có dạng `muối$mã băm` (SHA-256 lặp 2000 vòng). Không sửa tay.
- `MaNV` phải trùng cột `ma_nv` trong `DM_NHA_TRAM`, `To` phải trùng `to_ha_tang`, nếu không người dùng sẽ không thấy trạm.

## 3. Các tab mới

| Tab | Nội dung chính |
|---|---|
| Đến hạn dán lại 2026 | Trạm có hạn (lấy giấy còn hạn lâu hơn giữa kiểm định/công bố) đã qua hoặc rơi trong 2026; tiến độ theo Tổ |
| Lịch hết hạn & cảnh báo | Thẻ 30/31–60/61–90 ngày, biểu đồ theo năm, bảng xuất Excel |
| Nhật ký thao tác | Sheet `NHAT_KY`, chỉ ghi thêm; lọc và xuất Excel |
| Đối soát minh chứng | Thiếu ảnh/PDF, thiếu ngày hết hạn, ảnh trùng (MD5), tệp lỗi. Admin bấm **Quét tệp minh chứng** (sheet `HASH_MINH_CHUNG`) |
| Nhắc việc tự động | 3 quy tắc, xem trước, gửi thử, gửi ngay, lịch sử; sao chép tin để gửi Zalo tay |
| Tải giấy kiểm định mới | Đọc PDF, nhập mã CSHT, xác nhận, lưu Drive, cập nhật trạm |

Lưu ý: chưa kiểm tra "ảnh ngoài vị trí trạm" vì dữ liệu chưa có tọa độ.

## 4. Triển khai và cấu hình

### Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `VITE_APPSCRIPT_URL` | URL Web App của Apps Script (đặt trên Vercel hoặc file `.env`) |
| `APPSCRIPT_PROJECT_ID` | ID dự án Apps Script, dùng cho `npm run redeploy` |

Không đưa mật khẩu hay khóa vào mã nguồn. Hệ thống không cần khóa API nào khác.

### Deploy backend

1. `npm run redeploy` (đẩy `Code.gs`, `Auth.gs`, `Reminders.gs`, `Certificates.gs`, `appsscript.json`).
2. Lần đầu sau khi cập nhật, Google yêu cầu **cấp lại quyền** (thêm gửi email và tạo trigger). Chấp nhận bằng tài khoản chủ dự án.
3. Chạy hàm `authSetup` một lần trong Apps Script để tạo cột bổ sung cho `NguoiDung`.
4. **Lưu ý**: sau khi deploy, mọi người phải đăng nhập mới dùng được app (kể cả các mục cũ). Thông báo cho các Tổ trước.

### Deploy giao diện

`npm run build` rồi triển khai thư mục `dist` (Vercel tự build khi đẩy mã).

## 5. Sao lưu

- Trước khi đổi cấu trúc hoặc cập nhật hàng loạt: Google Sheet → **Tệp → Tạo bản sao**, hoặc xem **Lịch sử phiên bản**.
- Sheet cần sao lưu định kỳ: `NguoiDung`, `DM_NHA_TRAM`, `KIEM_DINH_BTS`, `NHAT_KY`, `NHAC_VIEC_LICH_SU`.
- File PDF/ảnh nằm trong thư mục Drive `anhkiemdinhBTS/<Tổ>/<Nhân viên>`. File bị ghi đè chỉ vào thùng rác Drive (khôi phục được).

## 6. Rủi ro bảo mật còn lại

- Mật khẩu mặc định `1` yếu. Giảm rủi ro: yêu cầu mọi người đổi mật khẩu ngay lần đầu, theo dõi tài khoản còn dùng mật khẩu mặc định, admin đặt lại khi nghi ngờ.
- Backend vẫn là Web App "Anyone": ai biết URL đều gọi được, nhưng mọi dữ liệu và thao tác đều cần phiên đăng nhập hợp lệ.
- Phiên đăng nhập lưu trong bộ đệm Apps Script (có thể mất sớm, khi đó chỉ cần đăng nhập lại).
- Thư mục Drive đặt chia sẻ "bất kỳ ai có link" như ảnh niêm yết hiện có; không tải giấy chứa thông tin nhạy cảm.
- Email nhắc gửi từ tài khoản Google chủ dự án, hạn mức khoảng 100 email/ngày với tài khoản thường.
