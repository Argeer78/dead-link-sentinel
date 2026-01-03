'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
    const router = useRouter();

    useEffect(() => {
        // The supabase client fits right into the Next.js client-side flow.
        // It automatically detects the hash/query params and handles the exchange
        // when we access the session.

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                router.replace('/dashboard');
            } else {
                // If no session found immediately, listen for the event
                // (sometimes needed if the exchange takes a split second)
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' && session) {
                        router.replace('/dashboard');
                    }
                });
                return () => subscription.unsubscribe();
            }
        });
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Verifying Login...</h2>
                <p className="text-gray-500">Please wait while we log you in.</p>
            </div>
        </div>
    );
}
