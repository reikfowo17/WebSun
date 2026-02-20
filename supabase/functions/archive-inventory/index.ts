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
    totalReports?: number
    fileSizeBytes?: number
    summaryResult?: any
    purgeResult?: any
    reportPurgeResult?: any
    historyPurgeResult?: any
    error?: string
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)
        let targetDate: string | null = null
        let skipPurge = false
        let daysToKeep = 7
        let reportDaysToKeep = 30
        let historyDaysToKeep = 30

        try {
            const body = await req.json()
            targetDate = body.date || null
            skipPurge = body.skipPurge || false
            daysToKeep = body.daysToKeep || 7
            reportDaysToKeep = body.reportDaysToKeep || 30
            historyDaysToKeep = body.historyDaysToKeep || 30
        } catch {
        }

        const archiveDate = targetDate || new Date().toISOString().split('T')[0]
        console.log(`📦 Starting archive for date: ${archiveDate}`)

        const { data: existingLog } = await supabase
            .from('inventory_archive_log')
            .select('id, status')
            .eq('archive_date', archiveDate)
            .single()

        if (existingLog?.status === 'ARCHIVED' || existingLog?.status === 'PURGED') {
            console.log(`⚠️ Date ${archiveDate} already archived, skipping archive step`)

            let reportPurgeResult = null
            let historyPurgeResult = null

            if (!skipPurge) {
                try {
                    const { data } = await supabase
                        .rpc('purge_old_reports', { days_to_keep: reportDaysToKeep })
                    reportPurgeResult = data
                    console.log(`📋 Report purge result:`, data)
                } catch (e: any) {
                    console.error('⚠️ Report purge failed:', e.message)
                }

                try {
                    const { data } = await supabase
                        .rpc('purge_old_history', { days_to_keep: historyDaysToKeep })
                    historyPurgeResult = data
                    console.log(`📜 History purge result:`, data)
                } catch (e: any) {
                    console.error('⚠️ History purge failed:', e.message)
                }
            }

            return new Response(
                JSON.stringify({
                    success: true,
                    date: archiveDate,
                    message: 'Already archived, purge completed',
                    status: existingLog.status,
                    reportPurgeResult,
                    historyPurgeResult,
                }),
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

        let reportMetadata = null
        try {
            const { data, error } = await supabase
                .rpc('build_report_metadata_json', { target_date: archiveDate })
            if (!error && data) {
                reportMetadata = data
                console.log(`📋 Report metadata: ${data.total_reports} reports for ${archiveDate}`)
            }
        } catch (e: any) {
            console.error('⚠️ Report metadata build failed:', e.message)
        }

        if (reportMetadata && reportMetadata.total_reports > 0) {
            archiveJson.reports = reportMetadata.reports
            archiveJson.total_reports = reportMetadata.total_reports
        }
        const dateObj = new Date(archiveDate)
        const year = dateObj.getFullYear()
        const month = String(dateObj.getMonth() + 1).padStart(2, '0')
        const day = String(dateObj.getDate()).padStart(2, '0')
        const filePath = `${year}/${month}/LSKT_${year}-${month}-${day}.json`

        const jsonString = JSON.stringify(archiveJson, null, 2)
        const jsonBytes = new TextEncoder().encode(jsonString)

        console.log(`📤 Uploading ${filePath} (${jsonBytes.length} bytes, ${archiveJson.total_items} items, ${reportMetadata?.total_reports || 0} reports)`)

        const { error: uploadError } = await supabase.storage
            .from('inventory-archive')
            .upload(filePath, jsonBytes, {
                contentType: 'application/json',
                upsert: true
            })

        if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`)
        }

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
                    exported_at: archiveJson.exported_at,
                    total_reports: reportMetadata?.total_reports || 0
                }
            }, { onConflict: 'archive_date' })

        if (logError) {
            console.error('⚠️ Failed to log archive:', logError.message)
        }

        let summaryResult = null
        try {
            const { data } = await supabase
                .rpc('generate_daily_summary', { target_date: archiveDate })
            summaryResult = data
            console.log(`📊 Summary generated:`, data)
        } catch (e: any) {
            console.error('⚠️ Summary generation failed:', e.message)
        }

        let purgeResult = null
        let reportPurgeResult = null
        let historyPurgeResult = null

        if (!skipPurge) {
            try {
                const { data } = await supabase
                    .rpc('purge_old_inventory_items', { days_to_keep: daysToKeep })
                purgeResult = data
                console.log(`🗑️ Items purge result:`, data)
            } catch (e: any) {
                console.error('⚠️ Items purge failed:', e.message)
            }

            try {
                const { data } = await supabase
                    .rpc('purge_old_reports', { days_to_keep: reportDaysToKeep })
                reportPurgeResult = data
                console.log(`📋 Report purge result:`, data)
            } catch (e: any) {
                console.error('⚠️ Report purge failed:', e.message)
            }

            try {
                const { data } = await supabase
                    .rpc('purge_old_history', { days_to_keep: historyDaysToKeep })
                historyPurgeResult = data
                console.log(`📜 History purge result:`, data)
            } catch (e: any) {
                console.error('⚠️ History purge failed:', e.message)
            }
        }

        const result: ArchiveResult = {
            success: true,
            date: archiveDate,
            filePath,
            totalItems: archiveJson.total_items,
            totalStores: archiveJson.total_stores,
            totalReports: reportMetadata?.total_reports || 0,
            fileSizeBytes: jsonBytes.length,
            summaryResult,
            purgeResult,
            reportPurgeResult,
            historyPurgeResult,
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
