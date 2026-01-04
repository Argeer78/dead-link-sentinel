import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const headerPayload = await headers();
        const signature = headerPayload.get('stripe-signature');

        if (!signature) {
            return NextResponse.json({ error: 'No signature' }, { status: 400 });
        }

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        } catch (err: any) {
            console.error(`Webhook signature verification failed.`, err.message);
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
        }

        // Handle the event
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.user_id;
                const customerId = session.customer as string;
                const subscriptionId = session.subscription as string;

                if (userId) {
                    await supabaseAdmin.from('subscriptions').upsert({
                        user_id: userId,
                        stripe_customer_id: customerId,
                        stripe_subscription_id: subscriptionId,
                        status: 'active',
                        updated_at: new Date()
                    }, { onConflict: 'user_id' });
                }
                break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                // We need to find the user associated with this subscription
                // Best way is to query by stripe_subscription_id

                await supabaseAdmin.from('subscriptions').update({
                    status: subscription.status,
                    current_period_end: new Date((subscription as any).current_period_end * 1000),
                    updated_at: new Date()
                }).eq('stripe_subscription_id', subscription.id);
                break;
            }
        }

        return NextResponse.json({ received: true });

    } catch (e: any) {
        console.error('Webhook error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
