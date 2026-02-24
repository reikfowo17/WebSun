const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BRANCH_MAPPING: Record<string, string> = {
    'BEE': 'SM BEE',
    'PLAZA': 'SM-PLAZA',
    'MIEN_DONG': 'SM MIỀN ĐÔNG',
    'HT_PEARL': 'SM HT PEARL',
    'GREEN_TOPAZ': 'GREEN TOPAZ',
    'EMERALD': 'SM EMERALD'
};

const TOKEN_URL = 'https://id.kiotviet.vn/connect/token';
const API_URL = 'https://public.kiotapi.com';

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
        throw new Error(`KiotViet auth failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.access_token) {
        console.error('[KiotViet Token] No access_token in response:', JSON.stringify(data));
        throw new Error('KiotViet auth response missing access_token');
    }

    console.log('[KiotViet Token] OK, expires_in:', data.expires_in);
    return data.access_token;
}

function jsonResponse(body: any, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const storeCode = body.storeCode;
        console.log('[kiotviet-stock] Request storeCode:', storeCode);

        if (!storeCode) {
            return jsonResponse({ success: false, error: 'Thiếu storeCode' }, 400);
        }

        const retailer = Deno.env.get('KIOTVIET_RETAILER');
        const clientId = Deno.env.get('KIOTVIET_CLIENT_ID');
        const clientSecret = Deno.env.get('KIOTVIET_CLIENT_SECRET');

        if (!retailer || !clientId || !clientSecret) {
            console.error('[kiotviet-stock] Missing env vars:', { retailer: !!retailer, clientId: !!clientId, clientSecret: !!clientSecret });
            return jsonResponse({ success: false, error: 'Thiếu cấu hình KiotViet trên máy chủ' }, 400);
        }

        // 1. Get Token  
        const token = await getKiotVietToken(clientId, clientSecret);

        // 2. Resolve branch  
        const targetBranchName = BRANCH_MAPPING[storeCode] || storeCode;
        console.log('[kiotviet-stock] Resolving branch:', targetBranchName);

        const branchesRes = await fetch(`${API_URL}/branches`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Retailer': retailer }
        });

        if (!branchesRes.ok) {
            const errText = await branchesRes.text();
            console.error(`[kiotviet-stock] Branches API error: ${branchesRes.status}`, errText);
            return jsonResponse({ success: false, error: `KiotViet branches API error: ${branchesRes.status}` }, 502);
        }

        const branchesData = await branchesRes.json();
        const allBranches = branchesData.data || [];
        console.log('[kiotviet-stock] Found branches:', allBranches.map((b: any) => b.branchName));

        const branch = allBranches.find((b: any) =>
            b.branchName && b.branchName.toLowerCase().includes(targetBranchName.toLowerCase())
        );

        if (!branch) {
            return jsonResponse({
                success: false,
                error: `Không tìm thấy chi nhánh: "${targetBranchName}". Có: ${allBranches.map((b: any) => b.branchName).join(', ')}`
            }, 404);
        }

        const branchId = branch.id;
        console.log('[kiotviet-stock] Matched branch:', branch.branchName, 'ID:', branchId);

        // 3. Get stock  
        const stockMap: Record<string, number> = {};
        let currentItem = 0;
        let total = 0;
        const pageSize = 100;

        do {
            const url = `${API_URL}/products?pageSize=${pageSize}&currentItem=${currentItem}&includeInventory=true`;
            const productsRes = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Retailer': retailer }
            });

            if (!productsRes.ok) {
                console.error(`[kiotviet-stock] Products API error at page ${currentItem}: ${productsRes.status}`);
                break;
            }

            const data = await productsRes.json();
            total = data.total || 0;

            if (data.data) {
                for (const p of data.data) {
                    if (p.barCode && p.inventories) {
                        const inv = p.inventories.find((i: any) => i.branchId === branchId);
                        if (inv) {
                            stockMap[p.barCode] = inv.onHand || 0;
                        }
                    }
                }
                currentItem += data.data.length;
            } else {
                break;
            }
        } while (currentItem < total);

        console.log(`[kiotviet-stock] Done. ${Object.keys(stockMap).length} products mapped from ${total} total.`);

        return jsonResponse({ success: true, stockMap });

    } catch (e: any) {
        console.error('[kiotviet-stock] Unhandled error:', e.message, e.stack);
        return jsonResponse({ success: false, error: e.message }, 500);
    }
});
