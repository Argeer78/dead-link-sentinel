import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { crawlPage } from '@/lib/crawler';
import { sendReportEmail } from '@/lib/email';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 1. Find stale sites (Using Admin Client to bypass RLS)
    const { data: sites } = await supabaseAdmin
        .from('sites')
        .select('*')
        .order('last_checked_at', { ascending: true, nullsFirst: true })
        .limit(2);

    if (!sites || sites.length === 0) return NextResponse.json({ message: 'No sites to check' });

    const results = [];

    for (const site of sites) {
        console.log(`Checking ${site.url}...`);
        const result = await crawlPage(site.url);
        results.push({ url: site.url, broken: result.brokenLinks.length });

        // 2. Update Site & Save Report (Admin)
        await supabaseAdmin.from('sites').update({
            last_checked_at: new Date().toISOString(),
            status: result.brokenLinks.length > 0 ? 'error' : 'idle'
        }).eq('id', site.id);

        await supabaseAdmin.from('reports').insert({
            site_id: site.id,
            scanned_count: result.scannedCount,
            broken_links: result.brokenLinks
        });
    }

    return NextResponse.json({ success: true, checked: results });
}
