import { createClient } from '@supabase/supabase-js'
import { Database } from './database.types'

// Supabase project configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
  )
}

// Create the Supabase client with TypeScript support
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'ridevault-web'
    }
  }
})

// Helper function to get the current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) {
    console.error('Error getting current user:', error)
    return null
  }
  return user
}

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
    return false
  }
  return true
}

// Helper function to clear stale authentication sessions
export const clearStaleSession = async () => {
  try {
    // First try to get the current session
    const { data: session } = await supabase.auth.getSession()
    
    if (session.session) {
      // If there's a session, try to validate the user
      const { error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        // If user validation fails, clear the session
        console.warn('Clearing stale session due to:', userError.message)
        await supabase.auth.signOut()
        
        // Also clear any stored tokens from browser storage
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token')
          sessionStorage.removeItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token')
        }
        
        return true // Session was cleared
      }
    }
    
    return false // No stale session found
  } catch (error) {
    console.warn('Error checking session:', error)
    // If any error occurs, try to sign out
    await supabase.auth.signOut()
    return true
  }
}

// Export the client as default
export default supabase 