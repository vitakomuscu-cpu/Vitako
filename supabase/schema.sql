-- Vitako : tables et règles de sécurité (Supabase)
-- À coller dans Supabase > SQL Editor > New query, puis "Run".

-- 1) Profil du client : une ligne par compte, les données du site sont stockées en JSON.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint profiles_data_size check (octet_length(data::text) < 200000)
);

alter table public.profiles enable row level security;

-- Chaque client ne voit et ne modifie que SA ligne. Pas de suppression directe :
-- la ligne disparaît automatiquement si le compte est supprimé (on delete cascade).
drop policy if exists "profil : lecture par son propriétaire" on public.profiles;
create policy "profil : lecture par son propriétaire"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profil : création par son propriétaire" on public.profiles;
create policy "profil : création par son propriétaire"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profil : modification par son propriétaire" on public.profiles;
create policy "profil : modification par son propriétaire"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 2) Abonnements : le client peut LIRE le sien, mais seul le serveur Stripe
--    (clé secrète / service_role) peut écrire, après un paiement confirmé.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text check (plan in ('train', 'nutri', 'full')),
  status text,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "abonnement : lecture par son propriétaire" on public.subscriptions;
create policy "abonnement : lecture par son propriétaire"
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);
-- Aucune politique insert/update/delete : les clients ne peuvent pas s'attribuer un abonnement.
