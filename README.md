# Hướng dẫn sử dụng để đồng bộ bài của nhóm

## Bước 1: Cài Đặt Git và Tạo Tài Khoản GitHub
- **Cài đặt Git:**  
  - Tải Git tại [git-scm.com](https://git-scm.com) và làm theo hướng dẫn cài đặt cho hệ điều hành của bạn.
- **Tạo tài khoản GitHub:**  
  - Truy cập [github.com](https://github.com) và đăng ký tài khoản miễn phí.
  - Cấu hình Git với tên và email của bạn bằng cách chạy:
    ```bash
    git config --global user.name "Tên của bạn"
    git config --global user.email "email@example.com"
    ```

## Bước 2: Đồng bộ Repository mới nhất
- **Clone repository về máy tính:**  
  - Sử dụng lệnh:
    ```bash
    git clone https://github.com/username/repository-name.git
    ```
  - Điều này sẽ tạo một bản sao của repository trên máy tính của bạn.

## Bước 3: Làm Việc Với Branches và Commit
- **Tạo branch mới:**  
  - Mỗi tính năng hoặc sửa lỗi nên được phát triển trên một branch riêng. Tạo branch mới bằng lệnh:
    ```bash
    git checkout -b ten-branch-moi
    ```
- **Thực hiện commit:**  
  - Sau khi thay đổi mã nguồn, thêm các thay đổi vào staging area:
    ```bash
    git add .
    ```
  - Commit các thay đổi với thông điệp rõ ràng:
    ```bash
    git commit -m "Mô tả các thay đổi đã thực hiện"
    ```
- **Push branch lên GitHub:**  
  - Đẩy branch mới lên repository:
    ```bash
    git push origin ten-branch-moi
    ```

## Bước 4: Sử Dụng Pull Requests (PR)
- **Tạo Pull Request:**  
  - Trên GitHub, chuyển đến tab “Pull requests” và nhấp “New pull request”.
  - Chọn branch của bạn so sánh với branch chính (thường là `main` hoặc `master`).
- **Review code:**  
  - Các thành viên khác trong nhóm sẽ kiểm tra và review code của bạn.
  - Trao đổi ý kiến và thực hiện thay đổi nếu cần.
- **Merge Pull Request:**  
  - Sau khi nhận được sự đồng ý từ các thành viên, pull request sẽ được merge vào branch chính.

## Bước 5: Quản Lý Issues và Dự Án
- **Issues:**  
  - Dùng Issues để theo dõi lỗi, đề xuất tính năng hoặc thảo luận các vấn đề cần giải quyết.
  - Tạo Issue mới và gán cho các thành viên phù hợp.
- **Projects và Milestones:**  
  - Sử dụng tab “Projects” để quản lý tiến độ dự án theo dạng Kanban (To Do, In Progress, Done).
  - Thiết lập Milestones để theo dõi các mốc thời gian quan trọng trong dự án.

## Bước 6: Giao Tiếp và Hợp Tác Trong Nhóm
- **Giao tiếp:**  
  - Sử dụng comment trong pull request và issues để trao đổi ý kiến.
  - Kết hợp với các công cụ giao tiếp như Slack, Microsoft Teams hoặc Discord để bàn luận và cập nhật tiến độ.
- **Đồng bộ hóa:**  
  - Trước khi bắt đầu làm việc, hãy đảm bảo rằng bạn luôn pull các thay đổi mới nhất từ branch chính:
    ```bash
    git pull origin main
    ```
  - Giúp tránh xung đột khi merge code.

## Bước 7: Tích Hợp Kiểm Thử và CI/CD (Tùy Chọn)
- **Kiểm thử tự động:**  
  - Thiết lập các script kiểm thử tự động để đảm bảo mã nguồn không bị lỗi khi có thay đổi.
- **CI/CD:**  
  - Sử dụng GitHub Actions để tự động chạy kiểm thử, build và deploy dự án sau mỗi lần merge code.
  - Điều này giúp phát hiện lỗi sớm và đảm bảo chất lượng code luôn được kiểm soát.

---

