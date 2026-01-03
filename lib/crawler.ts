import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

// Utility to ensure URL is absolute
function normalizeUrl(href: string, baseUrl: string): string | null {
    try {
        return new URL(href, baseUrl).href;
    } catch (e) {
        return null;
    }
}

interface BrokenLink {
    foundOn: string;
    target: string;
    status: number;
}

interface CrawlResult {
    brokenLinks: BrokenLink[];
    scannedCount: number;
}

// Global limit for concurrency (avoid strict rate limits)
const limit = pLimit(5);

export async function crawlPage(url: string): Promise<CrawlResult> {
    const brokenLinks: BrokenLink[] = [];
    let scannedCount = 0;

    try {
        // 1. Fetch the Target Page
        const response = await fetch(url, {
            headers: { 'User-Agent': 'DeadLinkSentinel/1.0' },
        });

        if (!response.ok) {
            // If the homepage itself is dead, return strictly that
            return {
                brokenLinks: [{ foundOn: 'START', target: url, status: response.status }],
                scannedCount: 1,
            };
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 2. Extract Links
        const linksToCheck: string[] = [];
        $('a').each((_, element) => {
            const href = $(element).attr('href');
            if (href) {
                const fullUrl = normalizeUrl(href, url);
                // Only check HTTP(S) links, ignore mailto/tel/#
                if (fullUrl && fullUrl.startsWith('http')) {
                    linksToCheck.push(fullUrl);
                }
            }
        });

        // Dedup links
        const uniqueLinks = Array.from(new Set(linksToCheck));
        scannedCount = uniqueLinks.length;

        // 3. Check Links Concurrently
        // Vercel limit: We should check roughly 50 links max for MVP to ensure speed
        const subsetLinks = uniqueLinks.slice(0, 50);

        const checks = subsetLinks.map((targetUrl) =>
            limit(async () => {
                try {
                    const res = await fetch(targetUrl, {
                        method: 'HEAD',
                        headers: { 'User-Agent': 'DeadLinkSentinel/1.0' },
                        // Set a short timeout for checks
                        signal: AbortSignal.timeout(5000),
                    });

                    if (res.status >= 400) {
                        // Some sites block HEAD, try GET as backup if 405/403
                        if (res.status === 405 || res.status === 403) {
                            const getRes = await fetch(targetUrl, {
                                method: 'GET',
                                headers: { 'User-Agent': 'DeadLinkSentinel/1.0' },
                                signal: AbortSignal.timeout(6000),
                            });
                            if (getRes.status >= 400) {
                                brokenLinks.push({ foundOn: url, target: targetUrl, status: getRes.status });
                            }
                        } else {
                            brokenLinks.push({ foundOn: url, target: targetUrl, status: res.status });
                        }
                    }
                } catch (error) {
                    // Network errors (DNS, timeout) count as broken (status 0)
                    brokenLinks.push({ foundOn: url, target: targetUrl, status: 0 });
                }
            })
        );

        await Promise.all(checks);

    } catch (error) {
        console.error('Critical Crawler Error:', error);
        // If main fetch fails, return it as a broken link
        return {
            brokenLinks: [{ foundOn: 'START', target: url, status: 0 }],
            scannedCount: 0,
        };
    }

    return { brokenLinks, scannedCount };
}
