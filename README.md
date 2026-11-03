# Dorm Manager — complete starter application

A simple roommate/household management app built with HTML, CSS, JavaScript and Supabase.

## Included
- Email/password registration and login
- Create a household and join with an invite code
- Shared dashboard
- Calendar events
- Chore assignments and completion status
- Shopping list with next buyer and last-purchased-by tracking
- Purchase history records
- Moving-in checklist
- Wishlist links
- Household messages, announcements and suggestions
- Shared expense records
- Household contacts
- Profile editing and password reset email
- Row Level Security policies so shared rows are limited to household members

## Important: one-time Supabase setup is required

The app cannot share data between roommates until you connect a Supabase project. The browser app uses the public anon key; database Row Level Security is enabled in `supabase.sql`. Never use a Supabase `service_role` key in `config.js`.

### 1. Create a Supabase project
1. Go to https://supabase.com and create a free project.
2. Open **SQL Editor** in your Supabase dashboard.
3. Open `supabase.sql`, copy the entire file, paste it into a new SQL query and run it.
4. Open **Project Settings → API** (or API Keys).
5. Copy the Project URL and the anon/public key.

### 2. Add your project credentials
1. Make a copy of `config.example.js` and name the copy `config.js`.
2. Replace `https://YOUR-PROJECT.supabase.co` with your Project URL.
3. Replace `YOUR_SUPABASE_ANON_PUBLIC_KEY` with your anon/public key.
4. Save `config.js`.

Do not publish `config.example.js` with real secrets. The anon key is designed for browser use when RLS policies are enabled. Never put a service-role key in the website.

### 3. Upload to GitHub
Upload `index.html`, `style.css`, `app.js`, `config.js`, and `supabase.sql` to the root of your existing `dorm-manager` repository. Keep the filenames exactly as shown. Commit the changes. GitHub Pages should redeploy automatically.

### 4. Test the application
1. Open your GitHub Pages URL.
2. Create an account. If email confirmation is enabled, confirm your email first.
3. Log in.
4. Open **Profile & Household** and create a household.
5. Copy the invite code and use a second test account (or roommate account) to join.
6. Add a shopping item, assign a next buyer, then mark it purchased. The last buyer and purchase history record are saved.
7. Try adding chores, events, messages, announcements and expenses.

For a classroom demo, use test accounts and fictional household information.

## Notes / current limitations
- This is a working first release, not a finished commercial product. Test all flows before presenting.
- Household creation and joining are implemented with Supabase RPC functions.
- The current membership model allows one household per user.
- Messages currently refresh when the page is re-rendered; live push subscriptions can be added after enabling the Supabase Realtime publication.
- The UI currently has a simple calendar event list rather than a month-grid calendar.
- File uploads/documents, household rules, direct messages, anonymous identity protection beyond hiding the displayed name, notification preferences, chore wheel automation, and recurring-task generation are not implemented in this first release.
- The application requires internet access and the Supabase project to be available.
- GitHub Pages hosts the static front end; Supabase hosts authentication and shared data.

## Tech
- Vanilla HTML/CSS/JavaScript
- Supabase JS v2 CDN
- Supabase Postgres, Auth, Row Level Security and RPC
