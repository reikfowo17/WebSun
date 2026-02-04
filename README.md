# 🌞 Sunmart Portal

Hệ thống quản lý cửa hàng Sunmart - Frontend Web Application

## 📁 Directory Structure

```
WebSun/
├── public/                   # Static assets
├── src/                      # Main source directory
│   ├── components/           # Shared UI components
│   │   ├── Layout.tsx        # Main layout wrapper
│   │   └── Sidebar.tsx       # Navigation sidebar
│   │
│   ├── pages/                # Page components (Views)
│   │   ├── Dashboard.tsx     # Admin/Employee dashboard
│   │   ├── Inventory.tsx     # Employee inventory check
│   │   ├── Expiry.tsx        # Employee expiry check
│   │   ├── InventoryHQ.tsx   # Admin inventory management
│   │   ├── RecoveryHub.tsx   # Admin recovery management
│   │   ├── Profile.tsx       # User profile
│   │   ├── Login.tsx         # Login page
│   │   └── Register.tsx      # Registration page
│   │
│   ├── contexts/             # React Context providers
│   │   ├── UserContext.tsx   # Auth state management
│   │   ├── ToastContext.tsx  # Toast notifications
│   │   └── index.ts          # Barrel exports
│   │
│   ├── services/             # API services (Business Logic)
│   │   ├── auth.ts           # Authentication service
│   │   ├── inventory.ts      # Inventory operations
│   │   ├── expiry.ts         # Expiry tracking
│   │   ├── dashboard.ts      # Dashboard stats
│   │   ├── recovery.ts       # Recovery/Truy thu
│   │   └── index.ts          # Barrel exports
│   │
│   ├── types/                # TypeScript definitions
│   │   └── index.ts          # All shared types
│   │
│   ├── hooks/                # Custom React hooks
│   │   └── index.ts          # Reusable hooks
│   │
│   ├── constants/            # App constants
│   │   └── index.ts          # Magic numbers, configs
│   │
│   ├── lib/                  # Utilities
│   │   └── supabase.ts       # Supabase client config
│   │
│   ├── App.tsx               # Main app component
│   ├── index.tsx             # Entry point
│   └── index.css             # Global styles (Tailwind)
│
├── index.html                # HTML Entry point
├── vite.config.ts            # Vite config
├── vercel.json               # Vercel deployment config
└── package.json              # Dependencies
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env.local` with:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Development Server
```bash
npm run dev
```
Open http://localhost:3000

### Test Accounts
| ID | Password | Role |
|---|----------|------|
| `ADMIN001` | `123456` | Admin |
| `EMP001` | `123456` | Employee |

## 🔧 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Vercel

## 📊 Key Architecture

### State Management
- **UserContext**: Global auth state, eliminates prop drilling
- **ToastContext**: Centralized notifications

### Service Layer
- Modular services per domain (auth, inventory, expiry, etc.)
- Each service handles Supabase queries + mock fallback

### Code Splitting
- `React.lazy()` for page components
- `Suspense` boundaries with loading skeletons

### Import Patterns
```tsx
// using Alias @ -> src (Recommended)
import { useUser } from '@/contexts';
import { Layout } from '@/components/Layout';

// Or Relative
import { DashboardService } from '../services'; 
```

## 🗄️ Database (Supabase)

### Core Tables
- **users** - Employee accounts with XP/Level
- **stores** - Store locations
- **products** - Product catalog
- **inventory_items** - Current inventory state
- **expiry_items** - Expiry tracking
- **recovery_items** - Discrepancy recovery
- **tasks** - Assigned work tasks
- **achievements** - Gamification

### Security
- RLS (Row Level Security) on all tables
- Optimized indexes for common queries
- SECURITY INVOKER views

## 🚀 Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Or connect GitHub repository on [vercel.com](https://vercel.com)

## 📄 License

Private - Sunmart Systems © 2026
