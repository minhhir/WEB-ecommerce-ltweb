# WEB-ecommerce-ltweb
E-COMMERCE-SYSTEM/
├── frontend/                  # Vai trò 2: Next.js (BFF + UI)
│   ├── app/                   # App Router (Next.js 13+)
│   │   ├── (auth)/            # Nhóm route đăng nhập/đăng ký
│   │   ├── (shop)/            # Nhóm route mua sắm (sản phẩm, giỏ hàng)
│   │   ├── (checkout)/        # Nhóm route thanh toán
│   │   ├── admin/             # Dashboard thống kê
│   │   └── api/               # API Routes của Next.js (xử lý session cookie nội bộ)
│   ├── actions/               # Server Actions (gọi Flask API, xử lý form)
│   ├── components/            # UI Components dùng chung (Header, Footer, Button...)
│   ├── lib/                   # Utility functions (format tiền tệ, xử lý ngày tháng)
│   ├── types/                 # Khai báo TypeScript Interfaces (cho User, Product...)
│   └── middleware.ts          # Chặn route yêu cầu đăng nhập/quyền admin
│
└── backend/                   # Vai trò 1 (Minh): Flask API + AI
    ├── app/
    │   ├── __init__.py        # Khởi tạo Flask App & Config
    │   ├── api/               # Tầng 3: Flask Blueprint Modules
    │   │   ├── auth.py
    │   │   ├── products.py
    │   │   ├── orders.py
    │   │   ├── cart.py
    │   │   └── admin.py
    │   ├── models/            # Tầng 5: SQLAlchemy ORM Models
    │   │   ├── __init__.py
    │   │   ├── user.py
    │   │   ├── product.py
    │   │   ├── order.py
    │   │   └── cart.py
    │   ├── services/          # Tầng 4: Logic nghiệp vụ & Machine Learning
    │   │   ├── checkout_service.py # Xử lý Transaction, Row-level lock
    │   │   └── ml_recommendation.py# Thuật toán Apriori/FP-Growth
    │   └── utils/             # Helper (JWT Auth, format response)
    ├── config.py              # Cấu hình môi trường (DB URI, Secret Key)
    ├── run.py                 # File entry-point chạy server Flask (Port 5000)
    ├── requirements.txt       # Danh sách thư viện (Flask, SQLAlchemy, scikit-learn...)
    └── .env                   # Biến môi trường nhạy cảm
