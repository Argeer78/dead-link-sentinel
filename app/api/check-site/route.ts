import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { crawlPage } from '@/lib/crawler';
import { sendReportEmail } from '@/lib/email';


// Set max duration for Vercel/Next.js (up to 60s on Pro, 10s on Hobby - crucial!)
export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { siteId, email } = await req.json();
        if (!siteId) return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });

        // 1. Get Site (as Admin)
        const { data: site, error: siteError } = await supabaseAdmin
            .from('sites')
            .select('*')
            .eq('id', siteId)
            .single();

        if (siteError || !site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        // 2. Run Crawler
        const result = await crawlPage(site.url);

        // 3a. Update Site Status (as Admin)
        await supabaseAdmin.from('sites').update({
            last_checked_at: new Date().toISOString(),
            status: result.brokenLinks.length > 0 ? 'error' : 'idle'
        }).eq('id', siteId);

        // 3b. Save Report (as Admin)
        const { error: insertError } = await supabaseAdmin.from('reports').insert({
            site_id: siteId,
            scanned_count: result.scannedCount,
            broken_links: result.brokenLinks, // Cast to JSON automatically
        });

        if (insertError) {
            console.error('DB Insert Error:', insertError);
            return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
        }

        // 4. Send Email (if email provided and broken links found)
        if (email && result.brokenLinks.length > 0) {
            await sendReportEmail(email, site.url, result.brokenLinks);
        }

        return NextResponse.json({ success: true, result });

    } catch (err: any) {
        console.error('Crawl Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
