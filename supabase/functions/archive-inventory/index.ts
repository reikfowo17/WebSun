// ============================================================================
// ARCHIVE INVENTORY — Supabase Edge Function
// Runs nightly via pg_cron to:
//   1. Build JSON snapshot of today's inventory data
//   2. Upload to Supabase Storage
//   3. Generate daily summary
//   4. Purge old data from DB (after 7 days)
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ArchiveResult {
    success: boolean
    date: string
    filePath?: string
    totalItems?: number
    totalStores?: number
    fileSizeBytes?: number
    summaryResult?: any
    purgeResult?: any
    error?: string
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client with service_role for full access
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Parse request body for optional params
        let targetDate: string | null = null
        let skipPurge = false
        let daysToKeep = 7

        try {
            const body = await req.json()
            targetDate = body.date || null
            skipPurge = body.skipPurge || false
            daysToKeep = body.daysToKeep || 7
        } catch {
            // No body — use defaults (today)
        }

        const archiveDate = targetDate || new Date().toISOString().split('T')[0]
        console.log(`📦 Starting archive for date: ${archiveDate}`)

        // Step 1: Check if already archived
        const { data: existingLog } = await supabase
            .from('inventory_archive_log')
            .select('id, status')
            .eq('archive_date', archiveDate)
            .single()

        if (existingLog?.status === 'ARCHIVED' || existingLog?.status === 'PURGED') {
            console.log(`⚠️ Date ${archiveDate} already archived, skipping`)
            return new Response(
                JSON.stringify({
                    success: true,
                    date: archiveDate,
                    message: 'Already archived',
                    status: existingLog.status
                } satisfies ArchiveResult & { message: string; status: string }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Step 2: Build archive JSON using DB function
        const { data: archiveJson, error: buildError } = await supabase
            .rpc('build_archive_json', { target_date: archiveDate })

        if (buildError) {
            throw new Error(`Build archive JSON failed: ${buildError.message}`)
        }

        if (!archiveJson || archiveJson.total_items === 0) {
            console.log(`📭 No inventory data for ${archiveDate}, nothing to archive`)
            return new Response(
                JSON.stringify({
                    success: true,
                    date: archiveDate,
                    totalItems: 0,
                    message: 'No data to archive'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Step 3: Upload JSON to Storage
        const dateObj = new Date(archiveDate)
        const year = dateObj.getFullYear()
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getDate()).padStart(2, '0')
        const filePath = `${year}/${month}/LSKT_${year}-${month}-${day}.json`

        const jsonString = JSON.stringify(archiveJson, null, 2)
        const jsonBytes = new TextEncoder().encode(jsonString)

        console.log(`📤 Uploading ${filePath} (${jsonBytes.length} bytes, ${archiveJson.total_items} items)`)

        const { error: uploadError } = await supabase.storage
            .from('inventory-archive')
            .upload(filePath, jsonBytes, {
                contentType: 'application/json',
                upsert: true
            })

        if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

        // Step 4: Log the archive
        const { error: logError } = await supabase
            .from('inventory_archive_log')
            .upsert({
                archive_date: archiveDate,
                file_path: filePath,
                total_items: archiveJson.total_items,
                total_stores: archiveJson.total_stores,
                file_size_bytes: jsonBytes.length,
                status: 'ARCHIVED',
                metadata: {
                    stores: Object.keys(archiveJson.stores || {}),
                    exported_at: archiveJson.exported_at
                }
            }, { onConflict: 'archive_date' })

        if (logError) {
            console.error('⚠️ Failed to log archive:', logError.message)
        }

        // Step 5: Generate daily summary
        let summaryResult = null
        try {
            const { data } = await supabase
                .rpc('generate_daily_summary', { target_date: archiveDate })
            summaryResult = data
            console.log(`📊 Summary generated:`, data)
        } catch (e: any) {
            console.error('⚠️ Summary generation failed:', e.message)
        }

        // Step 6: Purge old data (only if not skipped and data is old enough)
        let purgeResult = null
        if (!skipPurge) {
            try {
                const { data } = await supabase
                    .rpc('purge_old_inventory_items', { days_to_keep: daysToKeep })
                purgeResult = data
                console.log(`🗑️ Purge result:`, data)
            } catch (e: any) {
                console.error('⚠️ Purge failed:', e.message)
            }
        }

        const result: ArchiveResult = {
            success: true,
            date: archiveDate,
            filePath,
            totalItems: archiveJson.total_items,
            totalStores: archiveJson.total_stores,
            fileSizeBytes: jsonBytes.length,
            summaryResult,
            purgeResult
        }

        console.log(`✅ Archive complete for ${archiveDate}`)

        return new Response(
            JSON.stringify(result),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        console.error('❌ Archive error:', error.message)

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})
