# Supabase Setup Instructions

1.  **Create a Supabase Project**: Go to [supabase.com](https://supabase.com) and create a new project.
2.  **Run SQL Query**: 
    - Go to the **SQL Editor** in your Supabase dashboard.
    - Copy the contents of the `supabase_setup.sql` file (found in your project root).
    - Paste it into the editor and click **Run**.
3.  **Get API Keys**:
    - Go to **Project Settings > API**.
    - Copy the `Project URL` and `anon public` key.
4.  **Update Code**:
    - Open `src/js/supabase.js`.
    - Replace `'YOUR_SUPABASE_URL'` and `'YOUR_SUPABASE_ANON_KEY'` with your actual values.
5.  **Authentication**:
    - Build in Auth is enabled by default. We will use `verifyOtp` (Phone) or Email/Password. For simplicity in this demo, standard Email/Password is easiest to start, but the UI asks for "Phone". We can use Phone Auth if enabled in Supabase, or simulate it by appending `@mahalla.uz` to the phone number to treat it as an email login (common hack for prototypes). Let's assume standard **Email/Password** is enabled in Supabase Auth Providers.
