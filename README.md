# 🌞 Sunmart Portal

Hệ thống quản lý cửa hàng Sunmart

## 📁 Cấu trúc Project

```
WebSun/
├── lib/                # Library configurations
│   └── supabase.ts    # Supabase client
├── types/             # TypeScript type definitions
│   └── database.ts    # Supabase database types
├── components/        # React components tái sử dụng
│   ├── Layout.tsx    # Layout wrapper
│   └── Sidebar.tsx   # Sidebar navigation
├── pages/            # Các trang chính
│   ├── Login.tsx     # Trang đăng nhập
│   ├── Dashboard.tsx # Dashboard
│   ├── Inventory.tsx # Kiểm tồn kho
│   └── Expiry.tsx    # Kiểm hạn sử dụng
├── services/         # Service layers
│   └── api.ts        # API service (Supabase + Mock)
├── App.tsx           # Root component
├── index.tsx         # Entry point
├── index.html        # HTML template
├── index.css         # Global styles
├── types.ts          # Legacy types
├── vercel.json       # Vercel config
└── package.json      # Dependencies
```

## 🚀 Bắt đầu

### 1. Cài đặt Dependencies

```bash
npm install
```

### 2. Cấu hình Environment

Copy `.env.example` thành `.env.local` và điền thông tin:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Chạy Development Server

```bash
npm run dev
```

Mở http://localhost:3000

### Tài khoản test

| ID | Password | Role |
|---|----------|------|
| `ADMIN001` | `123456` | Admin |
| `EMP001` | `123456` | Employee - BEE |
| `EMP002` | `123456` | Employee - PLAZA |

## 🚀 Deploy lên Vercel

### Option 1: Qua Vercel CLI

```bash
# Cài Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### Option 2: Qua GitHub

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → Import Project
3. Chọn repository
4. Thêm Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

## 🔧 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS (CDN)
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel
- **Auth**: Supabase Auth (planned)

## 📊 Database Schema

### Tables
- **stores** - Danh sách cửa hàng
- **users** - Người dùng (admin/employee)
- **products** - Sản phẩm master data
- **inventory_items** - Kiểm tồn kho
- **expiry_items** - Theo dõi hạn sử dụng
- **tasks** - Nhiệm vụ

### Features
- Auto-update status triggers
- Computed columns (diff)
- Views for easy querying

## 📱 Tính năng

### 👨‍💼 Admin
- Dashboard tổng quan hệ thống
- Xem thống kê real-time từ Supabase
- Quản lý nhiệm vụ

### 👷 Employee
- Dashboard cá nhân với XP/Level
- Kiểm tồn kho (đối soát hàng hóa)
- Kiểm date (theo dõi hạn sử dụng)
- Gamification system

## 📄 License

Private - Sunmart Systems © 2026
