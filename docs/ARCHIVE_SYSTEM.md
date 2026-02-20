# Inventory Archive System — Implementation Plan

## Overview
This document describes the complete inventory archival system implemented for Sunmart's WebSun application. It replaces the manual Google Drive export workflow from `SMInvLib.js` with an automated, Supabase-native solution.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    HOT DATA (DB)                         │
│         inventory_items (last 7 days)                    │
│         inventory_reports (last 30 days)                 │
│         inventory_history (last 30 days)                 │
│         ↕ Real-time queries from frontend                │
└──────────┬───────────────────────────────────────────────┘
           │ pg_cron → Edge Function (nightly 23:30 ICT)
           ▼
┌──────────────────────────────────────────────────────────┐
│                   COLD DATA (Storage)                    │
│         inventory-archive bucket                         │
│         /{year}/{month}/LSKT_{date}.json                 │
│         Contains: items + report metadata                │
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

## Retention Policy

| Table | Hot (DB) | Cold (Storage) | Purge Condition |
|-------|----------|----------------|-----------------|
| `inventory_items` | 7 days | JSON archive forever | Auto-purge after 7 days |
| `inventory_reports` | 30 days | Metadata in archive JSON | Only APPROVED/REJECTED; PENDING never auto-purged |
| `inventory_history` | 30 days | Covered by archive JSON | Auto-purge after 30 days |
| `inventory_archive_log` | Forever | N/A | Never purged (lightweight metadata) |
| `inventory_daily_summary` | Forever | N/A | Never purged (aggregated stats) |

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `supabase/migrations/20260218215300_inventory_archive.sql` | DB migration: storage bucket, tables, functions |
| `supabase/migrations/20260219000000_pg_cron_schedule.sql` | pg_cron schedule (auto-deployed) |
| `supabase/migrations/20260221002400_purge_reports_history.sql` | DB functions: purge_old_reports, purge_old_history, build_report_metadata_json |
| `supabase/functions/archive-inventory/index.ts` | Edge Function: archive + purge (v2: includes reports/history) |
| `src/services/archive.ts` | Frontend service for archive operations |
| `src/pages/InventoryHQ/components/RecoveryScanModal.tsx` | Recovery scan UI |
| `src/pages/InventoryHQ/components/ArchiveStatusPanel.tsx` | Archive management UI |

### Modified Files
| File | Changes |
|------|---------|
| `src/services/index.ts` | Added InventoryArchiveService + ArchivedReportMetadata export |
| `src/pages/InventoryHQ/RecoveryView.tsx` | Added scan/archive buttons + modal integration |
| `tsconfig.json` | Excluded supabase/functions from tsc |

## Deployment Steps

### 1. ✅ SQL Migration (archive infrastructure)
```bash
npx supabase db push  # Applied 20260218215300_inventory_archive.sql
```

### 2. ✅ pg_cron Schedule
```bash
npx supabase db push  # Applied 20260219000000_pg_cron_schedule.sql
```

### 3. ⬜ SQL Migration (reports/history purge) — NEW
```bash
npx supabase db push  # Apply 20260221002400_purge_reports_history.sql
```
This creates:
- `purge_old_reports(days_to_keep)` — Deletes APPROVED/REJECTED reports older than N days
- `purge_old_history(days_to_keep)` — Deletes inventory_history older than N days
- `build_report_metadata_json(target_date)` — Snapshots report data for archive

### 4. ⬜ Edge Function Redeploy — NEW
```bash
npx supabase functions deploy archive-inventory --no-verify-jwt
```
This updates the nightly pipeline to:
- Include report metadata in archive JSON (Option A)
- Purge old reports + history after archiving (Option C)

### 5. ✅ Extensions Enabled (Dashboard)
- `pg_cron` — enabled
- `pg_net` — enabled

### 6. Frontend Deploy
Standard Vite build + deploy (when ready)

## How It Works

### Daily Archive Flow (Automated — v2)
1. **23:30 ICT** → pg_cron triggers `net.http_post()` to Edge Function
2. Edge Function calls `build_archive_json(CURRENT_DATE)` — builds items JSON from DB
3. **NEW:** Calls `build_report_metadata_json(CURRENT_DATE)` — snapshots report data
4. **NEW:** Merges report metadata into the archive JSON
5. Uploads combined JSON to Storage: `{year}/{month}/LSKT_{year}-{month}-{day}.json`
6. Logs to `inventory_archive_log` (includes total_reports in metadata)
7. Generates daily summary via `generate_daily_summary()`
8. Purges `inventory_items` older than 7 days
9. **NEW:** Purges `inventory_reports` (APPROVED/REJECTED) older than 30 days
10. **NEW:** Purges `inventory_history` older than 30 days

### Archive JSON Structure (v2)
```json
{
  "date": "2026-02-21",
  "exported_at": "2026-02-21T16:30:00Z",
  "total_items": 1200,
  "total_stores": 6,
  "stores": {
    "CH01": {
      "shift_1": [ { "product_name": "...", "barcode": "...", ... } ]
    }
  },
  "total_reports": 12,
  "reports": [
    {
      "id": "uuid",
      "store_code": "CH01",
      "store_name": "Cửa hàng 01",
      "shift": 1,
      "check_date": "2026-02-21",
      "status": "APPROVED",
      "submitted_by": "Nguyễn Văn A",
      "submitted_at": "2026-02-21T08:00:00Z",
      "reviewed_by": "Admin",
      "reviewed_at": "2026-02-21T10:00:00Z",
      "rejection_reason": null,
      "created_at": "2026-02-21T08:00:00Z"
    }
  ]
}
```

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

## Configurable Retention Periods

The Edge Function accepts optional parameters via request body:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `daysToKeep` | 7 | Days to keep `inventory_items` in DB |
| `reportDaysToKeep` | 30 | Days to keep APPROVED/REJECTED reports |
| `historyDaysToKeep` | 30 | Days to keep `inventory_history` records |
| `skipPurge` | false | Skip all purge operations |

## Cost Analysis (Supabase Free Tier)

| Resource | Limit | Expected Usage (with purge) | Without Purge (1 year) |
|----------|-------|-----------------------------|------------------------|
| DB Size | 500 MB | ~25 MB (steady state) ✅ | ~300 MB ⚠️ |
| Storage | 1 GB | ~180 MB/year ✅ | ~180 MB/year ✅ |
| Edge Functions | 500K invocations/mo | ~30/mo ✅ | ~30/mo ✅ |
| Bandwidth | 5 GB/mo | ~10 MB/mo ✅ | ~10 MB/mo ✅ |

## Migration from Old System

| Old (`SMInvLib.js`) | New (Archive System v2) |
|---------------------|------------------------|
| Manual "Lưu LSKT" button | Automated nightly pg_cron |
| Google Sheets export | JSON to Supabase Storage |
| Drive folder hierarchy | `{year}/{month}/` path structure |
| `scanLSKTFilesForMonth()` | `InventoryArchiveService.scanForMissingProducts()` |
| Manual recovery file creation | Bulk recovery_items creation via UI |
| No purge mechanism | Auto-purge: items 7d, reports 30d, history 30d |
| No report archiving | Report metadata saved in archive JSON |
