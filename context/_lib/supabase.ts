import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types' // Import the generated types

// Define a function to create a Supabase client for client-side operations
export const createClient = () =>
  createBrowserClient<Database>( // Specify the Database type
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

// NOTE:
// For server-side operations (Server Components, API Routes, Route Handlers),
// you will need to use `createServerClient` or `createRouteHandlerClient`
// from '@supabase/ssr'. Refer to the Supabase SSR documentation for details:
// https://supabase.com/docs/guides/auth/server-side/nextjs 