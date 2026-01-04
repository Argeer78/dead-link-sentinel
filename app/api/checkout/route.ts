import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover', // Use latest or your specific version
});

export async function POST(req: Request) {
    try {
        // 1. Verify User (simplified for MVP - ideally use server-side auth helper)
        const { userId, email } = await req.json();

        if (!userId || !email) {
            return NextResponse.json({ error: 'Missing user data' }, { status: 400 });
        }

        const priceId = process.env.STRIPE_PRICE_ID;
        if (!priceId) {
            return NextResponse.json({ error: 'Stripe price not configured' }, { status: 500 });
        }

        // 2. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            customer_email: email, // Pre-fill email
            metadata: {
                user_id: userId, // Pass to webhook
            },
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            allow_promotion_codes: true,
            allow_promotion_codes: true,
            success_url: `${req.headers.get('origin')}/dashboard?success=true`,
            cancel_url: `${req.headers.get('origin')}/dashboard?canceled=true`,
            automatic_tax: { enabled: true },
            payment_method_configuration: undefined, // Let dashboard control it
            // payment_method_types: ['card'], // Removing this lets the dashboard settings take over!
            automatic_tax: { enabled: true },
            payment_method_configuration: undefined, // Let dashboard control it
            // payment_method_types: ['card'], // Removing this lets the dashboard settings take over!
        });

        return NextResponse.json({ url: session.url });

    } catch (e: any) {
        console.error('Stripe Checkout Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
