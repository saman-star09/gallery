# My Gallery

A Pinterest-style photo gallery: a waterfall masonry grid, click a photo to
view it full-size with a caption, drag-and-drop (or a button) to post new
ones. Anyone who visits can view the gallery; only you, signed in, can post
or delete photos.

It's a static site (Vite + TypeScript, no server of its own) backed by
[Supabase](https://supabase.com) for storage, the photo list, auth, and live
updates — so photos are visible from any device, not just the browser you
uploaded from.

## One-time setup (Supabase)

You need your own free Supabase project — this is *your* gallery's data, so
it lives in an account you control.

1. Create a project at [supabase.com](https://supabase.com) (the free tier is
   plenty for this).
2. **Database** — open the SQL Editor and run:

   ```sql
   create table public.photos (
     id uuid primary key default gen_random_uuid(),
     storage_path text not null,
     width integer not null,
     height integer not null,
     caption text,
     owner_id uuid not null references auth.users (id) default auth.uid(),
     created_at timestamptz not null default now()
   );

   alter table public.photos enable row level security;

   create policy "Anyone can view photos"
     on public.photos for select
     using (true);

   create policy "Authenticated users can add photos"
     on public.photos for insert
     to authenticated
     with check (auth.uid() = owner_id);

   create policy "Owners can update their photos"
     on public.photos for update
     to authenticated
     using (auth.uid() = owner_id);

   create policy "Owners can delete their photos"
     on public.photos for delete
     to authenticated
     using (auth.uid() = owner_id);

   -- powers the live "new photo just appeared" sync
   alter publication supabase_realtime add table public.photos;
   ```

3. **Storage** — go to Storage → Create a new bucket named `photos`, and
   check **Public bucket** (so photos load directly by URL). Then, back in
   the SQL Editor:

   ```sql
   create policy "Public can view photo files"
     on storage.objects for select
     using (bucket_id = 'photos');

   create policy "Authenticated users can upload photos"
     on storage.objects for insert
     to authenticated
     with check (bucket_id = 'photos');

   create policy "Owners can delete their photo files"
     on storage.objects for delete
     to authenticated
     using (bucket_id = 'photos' and owner = auth.uid());
   ```

4. **Your login** — there's deliberately no public sign-up form (so a
   stranger can't register and start posting). Create your own account
   instead: Authentication → Users → **Add user**, enter an email and
   password, and check **Auto Confirm User**. That's the account you'll sign
   in with on the site.
5. **Keys** — under Project Settings → API, copy the **Project URL** and the
   **anon public** key. (The anon key is meant to be public — it's what's
   embedded in the site's JS; actual access control comes from the RLS
   policies above, not from keeping that key secret.)

## Running it locally

```bash
cp .env.example .env.local   # then paste in your Project URL + anon key
npm install
npm run dev
```

## Deploying (GitHub Pages)

The included `.github/workflows/deploy-pages.yml` builds the site and
publishes it automatically on every push. Two things need to be set once:

1. **Repo secrets** — Settings → Secrets and variables → Actions → add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same values as
   your `.env.local`. They're baked into the build the same way the anon key
   always is — safe by design, but keeping them as secrets rather than
   hardcoded is still good hygiene.
2. **Pages source** — Settings → Pages → Build and deployment → Source →
   **GitHub Actions**. (If this is still set to "Deploy from a branch," the
   site will publish the raw, unbuilt source and show a blank page.)

## How it works

- **Viewing** is public and unauthenticated — the grid loads every row from
  the `photos` table and renders each as a masonry card via CSS `columns`
  (no layout library needed).
- **Posting** uploads the image file straight to Supabase Storage from the
  browser, reads its natural width/height (used to reserve the right space
  in the grid before the image finishes loading, avoiding layout shift), and
  inserts a row referencing it — gated by the RLS policies above to your
  signed-in user only.
- **Live sync** subscribes to Postgres changes on `photos` via Supabase
  Realtime, so a photo posted from your phone shows up in an already-open
  tab on your laptop without a refresh.
- **Auth** is email/password only, with no self-serve sign-up screen in the
  app — the one account is created directly in the Supabase dashboard, by
  design.
