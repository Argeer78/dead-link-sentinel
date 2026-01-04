'use client';

// import { redirect } from 'next/navigation'; // Unused
// import { createClient } from '@/lib/supabase'; // Unused

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils'; // Ensure this exists from previous steps

export default function Dashboard() {
    const [session, setSession] = useState<any>(null);
    const [sites, setSites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUrl, setNewUrl] = useState('');
    const [adding, setAdding] = useState(false);

    const [subscription, setSubscription] = useState<any>(null);

    useEffect(() => {
        // Check if we are potentially in a callback flow
        const isCallback = window.location.hash.includes('access_token') || window.location.search.includes('code');
        const isPaymentSuccess = window.location.search.includes('success=true');

        if (isPaymentSuccess) {
            // Clear the query param so it doesn't persist on refresh
            window.history.replaceState(null, '', '/dashboard');
            alert('Thank you for upgrading! Your account is now Pro.');
        }
        if (isCallback) setLoading(true);

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchSites(session.user.id);
                fetchSubscription(session.user.id);
                // Clean URL
                window.history.replaceState(null, '', '/dashboard');
            } else if (!isCallback) {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                setSession(session);
                fetchSites(session.user.id);
                fetchSubscription(session.user.id);
                setLoading(false);
            }
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function fetchSites(userId: string) {
        const { data } = await supabase.from('sites').select('*').order('created_at', { ascending: false });
        if (data) setSites(data);
        setLoading(false);
    }

    async function fetchSubscription(userId: string) {
        const { data } = await supabase.from('subscriptions').select('*').eq('user_id', userId).single();
        if (data) setSubscription(data);
    }

    async function addSite(e: React.FormEvent) {
        e.preventDefault();
        if (!session || !newUrl) return;

        // Limit Check
        const isPro = subscription?.status === 'active';
        if (!isPro && sites.length >= 1) {
            alert('Free plan is limited to 1 site. Please upgrade to Pro.');
            return;
        }

        setAdding(true);

        // Simple validation
        let url = newUrl;
        if (!url.startsWith('http')) url = 'https://' + url;

        const { error } = await supabase.from('sites').insert({
            url,
            user_id: session.user.id,
            status: 'idle'
        });

        if (error) alert(error.message);
        else {
            setNewUrl('');
            fetchSites(session.user.id);
        }
        setAdding(false);
    }

    async function deleteSite(id: string) {
        if (!confirm('Delete site?')) return;
        await supabase.from('sites').delete().eq('id', id);
        fetchSites(session?.user.id);
    }

    async function runCheck(siteId: string) {
        // Optimistic update
        setSites(sites.map(s => s.id === siteId ? { ...s, status: 'crawling' } : s));

        try {
            const res = await fetch('/api/check-site', {
                method: 'POST',
                body: JSON.stringify({ siteId, email: session?.user?.email }),
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || res.statusText);
            }
            const data = await res.json();
            alert('Scan complete! Found ' + data.result.brokenLinks.length + ' broken links.');
        } catch (e: any) {
            alert('Scan failed: ' + e.message);
        }
        fetchSites(session?.user.id);
    }

    async function handleUpgrade() {
        if (!session) return;
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
            else alert('Error creating checkout');
        } catch (e) {
            alert('Error upgrading');
        }
    }

    if (loading) return <div className="p-10">Loading...</div>;
    if (!session) return <LoginPage />;

    const isPro = subscription?.status === 'active';

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Dead Link Sentinel</h1>
                <div className="flex items-center gap-4">
                    {isPro ? (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">PRO</span>
                    ) : (
                        <button onClick={handleUpgrade} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                            Upgrade to Pro
                        </button>
                    )}
                    <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-500 hover:text-black">Sign Out</button>
                </div>
            </div>

            {/* Add Site */}
            <div className="bg-white p-6 rounded-lg border shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-4">Monitor a new site</h2>
                <div className="flex gap-4 items-center">
                    <form onSubmit={addSite} className="flex gap-4 flex-1">
                        <input
                            type="text"
                            placeholder="example.com"
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                            className="flex-1 p-2 border rounded-md"
                            required
                        />
                        <button
                            disabled={adding}
                            className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
                        >
                            {adding ? 'Adding...' : 'Add Site'}
                        </button>
                    </form>
                </div>
                {!isPro && sites.length >= 1 && (
                    <p className="text-xs text-amber-600 mt-2">Free plan limited to 1 site. Upgrade to add more.</p>
                )}
            </div>

            {/* Sites Grid */}
            <div className="grid gap-4">
                {sites.map(site => (
                    <div key={site.id} className="p-4 border rounded-lg bg-white flex justify-between items-center shadow-sm">
                        <div>
                            <a href={site.url} target="_blank" className="font-medium hover:underline flex items-center gap-2">
                                {site.url} <ExternalLink size={14} className="text-gray-400" />
                            </a>
                            <div className="text-sm text-gray-500 mt-1">
                                Status: <span className={cn(
                                    "font-medium",
                                    site.status === 'idle' && "text-gray-500",
                                    site.status === 'crawling' && "text-blue-500",
                                    site.status === 'error' && "text-red-500"
                                )}>{site.status.toUpperCase()}</span>
                                {site.last_checked_at && ` • Last Checked: ${new Date(site.last_checked_at).toLocaleDateString()}`}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {/* View Report Link (Placeholder for now) */}
                            {/* <a href={`/dashboard/${site.id}`} className="p-2 border rounded hover:bg-gray-50 text-sm">View Report</a> */}

                            <button
                                onClick={() => runCheck(site.id)}
                                disabled={site.status === 'crawling'}
                                className="p-2 border rounded hover:bg-gray-50 text-blue-600 disabled:opacity-50"
                                title="Run Scan Now"
                            >
                                <RefreshCw size={18} className={site.status === 'crawling' ? "animate-spin" : ""} />
                            </button>
                            <button
                                onClick={() => deleteSite(site.id)}
                                className="p-2 border rounded hover:bg-red-50 text-red-600"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
                {sites.length === 0 && <div className="text-center text-gray-400 py-10">No sites monitored yet. Add one above.</div>}
            </div>
        </div>
    );
}

function LoginPage() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);

    async function login(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`
            }
        });
        if (error) alert(error.message);
        else setSent(true);
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="max-w-md w-full bg-white p-8 rounded-lg border shadow-sm">
                <h1 className="text-2xl font-bold mb-2">Dead Link Sentinel</h1>
                <p className="text-gray-500 mb-6">Honest site monitoring.</p>

                {sent ? (
                    <div className="bg-green-50 text-green-800 p-4 rounded text-center">
                        Check your email for the magic link!
                    </div>
                ) : (
                    <form onSubmit={login} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Email</label>
                            <input
                                className="w-full p-2 border rounded"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <button className="w-full bg-black text-white py-2 rounded hover:bg-gray-800">
                            Send Magic Link
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}
