import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { crawlPage } from '@/lib/crawler';
import { sendReportEmail } from '@/lib/email';

export const maxDuration = 60; // Allow 60s for multiple sites
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // 1. Verify Cron Secret (Security)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 2. Fetch all sites
        const { data: sites, error: sitesError } = await supabaseAdmin
            .from('sites')
            .select('*');

        if (sitesError || !sites) {
            throw new Error('Failed to fetch sites');
        }

        const results = [];

        for (const site of sites) {
            try {
                // 3. User & Subscription Check
                const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(site.user_id);

                if (userError || !user || !user.email) continue;

                const isAdmin = user.email === 'sgouros2305@gmail.com';

                // Check Subscription
                const { data: sub } = await supabaseAdmin
                    .from('subscriptions')
                    .select('status')
                    .eq('user_id', site.user_id)
                    .single();

                const isPro = sub?.status === 'active';

                // Skip if not eligible
                if (!isAdmin && !isPro) continue;

                // 4. Run Scan
                const crawlResult = await crawlPage(site.url);

                // 5. Update DB
                await supabaseAdmin.from('sites').update({
                    last_checked_at: new Date().toISOString(),
                    status: crawlResult.brokenLinks.length > 0 ? 'error' : 'idle'
                }).eq('id', site.id);

                await supabaseAdmin.from('reports').insert({
                    site_id: site.id,
                    scanned_count: crawlResult.scannedCount,
                    broken_links: crawlResult.brokenLinks,
                });

                // 6. Send Email if issues found
                if (crawlResult.brokenLinks.length > 0) {
                    await sendReportEmail(user.email, site.url, crawlResult.brokenLinks);
                }

                results.push({ site: site.url, status: 'scanned', broken: crawlResult.brokenLinks.length });

            } catch (innerErr) {
                console.error(`Error processing site ${site.url}:`, innerErr);
                results.push({ site: site.url, status: 'error' });
            }
        }

        return NextResponse.json({ success: true, processed: results.length, details: results });

    } catch (err: any) {
        console.error('Cron Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
