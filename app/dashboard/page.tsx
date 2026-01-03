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

    useEffect(() => {
        // Check if we are potentially in a callback flow
        const isCallback = window.location.hash.includes('access_token') || window.location.search.includes('code');
        if (isCallback) setLoading(true);

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                fetchSites(session.user.id);
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

    async function addSite(e: React.FormEvent) {
        e.preventDefault();
        if (!session || !newUrl) return;
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
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            alert('Scan complete! Found ' + data.result.brokenLinks.length + ' broken links.');
        } catch (e: any) {
            alert('Scan failed: ' + e.message);
        }
        fetchSites(session?.user.id);
    }

    if (loading) return <div className="p-10">Loading...</div>;
    if (!session) return <LoginPage />;

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Dead Link Sentinel</h1>
                <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-500 hover:text-black">Sign Out</button>
            </div>

            {/* Add Site */}
            <div className="bg-white p-6 rounded-lg border shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-4">Monitor a new site</h2>
                <form onSubmit={addSite} className="flex gap-4">
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
