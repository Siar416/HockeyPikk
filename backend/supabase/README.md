# Supabase Backend

1. Create a Supabase project.
2. Open the SQL editor and run `backend/supabase/schema.sql`.
   - If you already ran it, re-run after pulling schema updates.
3. In Auth settings, enable Email/Password.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env`.
5. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `APP_URL` in `backend/.env`.
6. Restart the frontend dev server.

The app will create a board with 3 groups for the signed-in user the first
time the Today page loads.
