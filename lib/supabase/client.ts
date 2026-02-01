import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

// Supabase project configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
  )
}

// Create the Supabase client for browser usage
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl!, supabaseAnonKey!)
}

// Create singleton instance for backward compatibility
export const supabase = createClient()

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

// Export the client as default
export default supabase
