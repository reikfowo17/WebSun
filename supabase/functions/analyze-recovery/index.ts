const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TOKEN_URL = 'https://id.kiotviet.vn/connect/token';
const API_URL = 'https://public.kiotapi.com';

interface AnalyzeRequest {
    missingItems: any[];
    overItems: any[];
}

async function getKiotVietToken(clientId: string, clientSecret: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('scopes', 'PublicApi.Access');
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`[KiotViet Token] Status: ${res.status}, Body: ${errText}`);
        throw new Error(`KiotViet auth failed (${res.status})`);
    }

    const data = await res.json();
    if (!data.access_token) throw new Error('Token response missing access_token');
    console.log('[KiotViet Token] OK');
    return data.access_token;
}

function jsonResponse(body: any, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body: AnalyzeRequest = await req.json();
        const { missingItems, overItems } = body;
        console.log(`[analyze-recovery] Received ${missingItems?.length || 0} missing, ${overItems?.length || 0} over items`);

        const retailer = Deno.env.get('KIOTVIET_RETAILER');
        const clientId = Deno.env.get('KIOTVIET_CLIENT_ID');
        const clientSecret = Deno.env.get('KIOTVIET_CLIENT_SECRET');

        if (!retailer || !clientId || !clientSecret) {
            return jsonResponse({ success: false, error: 'Thiếu cấu hình KiotViet trên máy chủ' }, 400);
        }

        // 1. Get Token
        const token = await getKiotVietToken(clientId, clientSecret);

        // 2. Collect unique barcodes to query KiotViet
        const allBarcodes = [...(missingItems || []), ...(overItems || [])]
            .map(i => i.barcode)
            .filter(Boolean);
        const uniqueBarcodes = [...new Set(allBarcodes)];
        console.log(`[analyze-recovery] Querying KiotViet for ${uniqueBarcodes.length} unique barcodes`);

        // 3. Fetch product info from KiotViet (category + price)
        let kiotProducts: any[] = [];
        const chunkSize = 20;
        for (let i = 0; i < uniqueBarcodes.length; i += chunkSize) {
            const chunk = uniqueBarcodes.slice(i, i + chunkSize);
            const codeParam = chunk.join(',');
            const url = `${API_URL}/products?code=${encodeURIComponent(codeParam)}&pageSize=100`;

            const productsRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Retailer': retailer }
            });

            if (productsRes.ok) {
                const data = await productsRes.json();
                if (data.data) kiotProducts = kiotProducts.concat(data.data);
            } else {
                console.warn(`[analyze-recovery] Products fetch chunk error: ${productsRes.status}`);
            }
        }

        console.log(`[analyze-recovery] Got ${kiotProducts.length} products from KiotViet`);

        // 4. Build metadata map: barcode -> { categoryId, basePrice }
        const productMeta: Record<string, { categoryId: number; basePrice: number }> = {};
        for (const p of kiotProducts) {
            if (p.code) productMeta[p.code] = { categoryId: p.categoryId, basePrice: p.basePrice };
            if (p.barCode) productMeta[p.barCode] = { categoryId: p.categoryId, basePrice: p.basePrice };
        }

        // 5. Cross-Offset matching
        const resolvedMissing = [...(missingItems || [])];
        const overPool = [...(overItems || [])];
        const matchedPairs: any[] = [];

        for (const missing of resolvedMissing) {
            if (missing.is_offset) continue;
            const metaMissing = productMeta[missing.barcode];
            if (!metaMissing) continue;

            const matchIdx = overPool.findIndex(over => {
                if (over.is_offset) return false;
                const metaOver = productMeta[over.barcode];
                if (!metaOver) return false;
                return metaOver.categoryId === metaMissing.categoryId &&
                    metaOver.basePrice === metaMissing.basePrice;
            });

            if (matchIdx !== -1) {
                missing.is_offset = true;
                missing.offset_with_barcode = overPool[matchIdx].barcode;
                overPool[matchIdx].is_offset = true;
                matchedPairs.push({ missing: missing.barcode, over: overPool[matchIdx].barcode });
            }
        }

        console.log(`[analyze-recovery] Matched ${matchedPairs.length} offset pairs`);

        return jsonResponse({
            success: true,
            data: {
                analyzedMissing: resolvedMissing,
                matchedCount: matchedPairs.length
            }
        });

    } catch (e: any) {
        console.error('[analyze-recovery] Error:', e.message, e.stack);
        return jsonResponse({ success: false, error: e.message }, 500);
    }
});
