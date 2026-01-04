  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null unique,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null, -- 'active', 'canceled', 'past_due', 'trialing'
  price_id text, -- To track which plan
  current_period_end timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table subscriptions enable row level security;

-- Policies
create policy "Users can view their own subscription" on subscriptions
  for select using (auth.uid() = user_id);

-- Update Sites Policy (Example of how you might enforce limits via RLS, though App-level check is easier for now)
-- We will handle the "Max 1 site" check in the API/Frontend logic for simplicity.
