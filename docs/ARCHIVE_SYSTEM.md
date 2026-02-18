# Inventory Archive System — Implementation Plan

## Overview
This document describes the complete inventory archival system implemented for Sunmart's WebSun application. It replaces the manual Google Drive export workflow from `SMInvLib.js` with an automated, Supabase-native solution.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    HOT DATA (DB)                         │
│         inventory_items (last 7 days)                    │
│         ↕ Real-time queries from frontend                │
└──────────┬───────────────────────────────────────────────┘
           │ pg_cron → Edge Function (nightly 23:30 ICT)
           ▼
┌──────────────────────────────────────────────────────────┐
│                   COLD DATA (Storage)                    │
│         inventory-archive bucket                         │
│         /{year}/{month}/LSKT_{date}.json                 │
│         ↕ Scan/download from ArchiveService              │
└──────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                 RECOVERY PIPELINE                        │
│   RecoveryScanModal → scans archived JSON files          │
│   → identifies missing products across months            │
│   → creates recovery_items in bulk                       │
└──────────────────────────────────────────────────────────┘
```

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260218215300_inventory_archive.sql` | DB migration: storage bucket, tables, functions |
| `supabase/migrations/20260219000000_pg_cron_schedule.sql` | pg_cron schedule (auto-deployed) |
| `supabase/functions/archive-inventory/index.ts` | Edge Function: archive + purge |
| `src/services/archive.ts` | Frontend service for archive operations |
| `src/pages/InventoryHQ/components/RecoveryScanModal.tsx` | Recovery scan UI |
| `src/pages/InventoryHQ/components/ArchiveStatusPanel.tsx` | Archive management UI |

### Modified Files
| File | Changes |
|------|---------|
| `src/services/index.ts` | Added InventoryArchiveService export |
| `src/pages/InventoryHQ/RecoveryView.tsx` | Added scan/archive buttons + modal integration |
| `tsconfig.json` | Excluded supabase/functions from tsc |

## Deployment Steps (✅ All Completed)

### 1. ✅ SQL Migration Pushed via CLI
```bash
npx supabase db push  # Applied 20260218215300_inventory_archive.sql
```

### 2. ✅ Edge Function Deployed
```bash
npx supabase functions deploy archive-inventory --no-verify-jwt
```

### 3. ✅ Extensions Enabled (Dashboard)
- `pg_cron` — enabled
- `pg_net` — enabled

### 4. ✅ pg_cron Schedule Pushed via CLI
```bash
npx supabase db push  # Applied 20260219000000_pg_cron_schedule.sql
```
Schedule: daily at 16:30 UTC (23:30 ICT)

### 5. Frontend Deploy
Standard Vite build + deploy (when ready)

## How It Works

### Daily Archive Flow (Automated)
1. **23:30 ICT** → pg_cron triggers `net.http_post()` to Edge Function
2. Edge Function calls `build_archive_json(CURRENT_DATE)` — builds JSON from DB
3. Uploads JSON to Storage: `{year}/{month}/LSKT_{year}-{month}-{day}.json`
4. Logs to `inventory_archive_log`
5. Generates daily summary via `generate_daily_summary()`
6. Purges records older than 7 days (only if archived)

### Recovery Scan Flow (User-Initiated)
1. User clicks "Quét lịch sử" in RecoveryView
2. RecoveryScanModal opens → user selects year/month
3. `InventoryArchiveService.scanForMissingProducts()` runs:
   - Lists all JSON files in `{year}/{month}/` from Storage
   - Downloads and parses each file
   - Tracks products with negative diff (missing)
   - Tracks `lastPositiveDate` for each product
   - Counts consecutive missing days
4. Results displayed in table with store filters
5. User selects products → bulk creates `recovery_items`

### Archive Management (User-Initiated)
- Toggle "Lưu trữ" view in RecoveryView toolbar
- Shows archive stats (total archived, purged, file sizes)
- Manual archive trigger for specific dates
- Archive log table with status tracking

## Cost Analysis (Supabase Free Tier)

| Resource | Limit | Expected Usage | Safety Margin |
|----------|-------|----------------|---------------|
| DB Size | 500 MB | ~50 MB (7 days) | 10x |
| Storage | 1 GB | ~180 MB/year | 5x |
| Edge Functions | 500K invocations/mo | ~30/mo | 16,000x |
| Bandwidth | 5 GB/mo | ~10 MB/mo | 500x |

## Migration from Old System

| Old (`SMInvLib.js`) | New (Archive System) |
|---------------------|---------------------|
| Manual "Lưu LSKT" button | Automated nightly pg_cron |
| Google Sheets export | JSON to Supabase Storage |
| Drive folder hierarchy | `{year}/{month}/` path structure |
| `scanLSKTFilesForMonth()` | `InventoryArchiveService.scanForMissingProducts()` |
| Manual recovery file creation | Bulk recovery_items creation via UI |
| No purge mechanism | Auto-purge after 7 days |
