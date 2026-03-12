# SOW Workbench — Supabase Setup Guide

Follow these steps once to connect the app to your Supabase project.
After this, all users, sessions, and opportunities live in the cloud.

---

## Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Name it `sow-workbench` (or anything you like)
4. Choose a strong database password (save it somewhere)
5. Pick the region closest to your team — US East works well
6. Wait ~2 minutes for the project to spin up

---

## Step 2 — Get your project credentials

In the Supabase dashboard, go to:
**Project Settings → API**

Copy these two values:
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon / public key** — the long JWT string

---

## Step 3 — Configure the app

1. In the project folder, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```

2. Open `.env` and fill in your values:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## Step 4 — Run the database schema

1. In the Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `supabase/migrations/001_initial_schema.sql` from this project
4. Paste the entire contents and click **Run**

This creates the `profiles` and `opportunities` tables with correct permissions.

---

## Step 5 — Create your admin account

### 5a — Create the auth user

1. Go to **Authentication → Users** in the Supabase dashboard
2. Click **Add User → Create New User**
3. Enter:
   - Email: `paul.newton@antennagroup.com`
   - Password: your password
   - ✅ Check **Auto Confirm User** (skips email confirmation)
4. Click **Create User**
5. Copy the UUID shown in the users table (looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 5b — Create the profile row

Back in **SQL Editor**, run this (replace the UUID with yours):

```sql
insert into public.profiles (id, name, email, role)
values (
  'paste-your-uuid-here',
  'Paul Newton',
  'paul.newton@antennagroup.com',
  'admin'
);
```

You can now sign in to the app with your credentials.

---

## Step 6 — Deploy the Edge Function

The Admin Panel uses a Supabase Edge Function to create, delete, and update users.

### Install Supabase CLI (if needed)
```bash
npm install -g supabase
```

### Link your project
```bash
supabase login
supabase link --project-ref your-project-ref
```
(Your project ref is the subdomain part of your URL — e.g. `abcdefgh` from `abcdefgh.supabase.co`)

### Deploy the function
```bash
supabase functions deploy admin-users
```

That's it — the function automatically gets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` injected by Supabase.

---

## Step 7 — Deploy the app (Vercel)

1. Push the project to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and import the repo
3. In the Vercel project settings, add these **Environment Variables**:
   ```
   VITE_SUPABASE_URL        = https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY   = your-anon-key-here
   ```
4. Deploy — Vercel will run `npm run build` automatically

---

## Adding team members

Once deployed, use the **Admin Panel** inside the app (⚙️ icon in the header) to create accounts for your team. Available roles:

| Role      | What they can do |
|-----------|-----------------|
| **growth** | Research → Brief → Proposal |
| **pm**     | Full pipeline including SOW generation |
| **reviewer** | SOW Review tool only |
| **admin**  | Everything + Admin Panel |

---

## Troubleshooting

**"Invalid email or password"** — check the user exists in Supabase Auth and has a matching profile row in `public.profiles`.

**"Account not set up correctly"** — the auth user exists but the profile row is missing. Run Step 5b again.

**Admin Panel fails to create users** — the Edge Function is not deployed or the project isn't linked. Re-run Step 6.

**App shows a blank loading spinner** — the `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` env var is wrong or missing.
