export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { ContentSection } from '@/types'

/**
 * Create authenticated Supabase client
 */
function createAuthenticatedSupabaseClient(token: string) {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  )
}

/**
 * Check if the current user is an admin and return the authenticated client
 */
async function getAuthenticatedClient(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createAuthenticatedSupabaseClient(token)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return null
    }

    const { data: authorized, error } = await supabase.rpc('authorize', {
      requested_permission: 'content.moderate'
    })

    if (error || !authorized) {
      return null
    }

    return supabase
  } catch (error) {
    console.error('Error checking admin status:', error)
    return null
  }
}

/**
 * PATCH /api/admin/countries/[countryCode]/content/reorder
 * Reorder content sections
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { countryCode: string } }
) {
  try {
    // Get authenticated Supabase client
    const supabase = await getAuthenticatedClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { countryCode } = params

    // Validate country code
    if (!countryCode || countryCode.length < 2) {
      return NextResponse.json(
        { error: 'Invalid country code' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate sectionIds array
    if (!body.sectionIds || !Array.isArray(body.sectionIds)) {
      return NextResponse.json(
        { error: 'sectionIds array is required' },
        { status: 400 }
      )
    }

    if (body.sectionIds.length === 0) {
      return NextResponse.json(
        { error: 'sectionIds array cannot be empty' },
        { status: 400 }
      )
    }

    // Validate that all items are strings
    if (!body.sectionIds.every((id: any) => typeof id === 'string')) {
      return NextResponse.json(
        { error: 'All section IDs must be strings' },
        { status: 400 }
      )
    }

    // Get existing sections
    const { data: countryData, error: fetchError } = await supabase
      .from('countries')
      .select('content_sections')
      .eq('code', countryCode)
      .single()

    if (fetchError) {
      console.error('Error fetching country:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch country data' },
        { status: 500 }
      )
    }

    const existingSections = (countryData?.content_sections as unknown as ContentSection[]) || []

    // Create a map for quick lookup
    const sectionMap = new Map(existingSections.map(s => [s.id, s]))

    // Reorder sections based on sectionIds array
    const reorderedSections: ContentSection[] = []
    body.sectionIds.forEach((id: string, index: number) => {
      const section = sectionMap.get(id)
      if (section) {
        reorderedSections.push({
          ...section,
          order: index + 1,
          updatedAt: new Date().toISOString(),
        })
      }
    })

    // Add any sections not in the sectionIds array at the end
    existingSections.forEach(section => {
      if (!body.sectionIds.includes(section.id)) {
        reorderedSections.push({
          ...section,
          order: reorderedSections.length + 1,
          updatedAt: new Date().toISOString(),
        })
      }
    })

    // Update database
    const { error: updateError } = await supabase
      .from('countries')
      .update({ content_sections: reorderedSections as any })
      .eq('code', countryCode)

    if (updateError) {
      console.error('Error reordering content sections:', updateError)
      return NextResponse.json(
        { error: 'Failed to reorder content sections' },
        { status: 500 }
      )
    }

    return NextResponse.json(reorderedSections)
  } catch (error) {
    console.error('Error reordering content sections:', error)
    return NextResponse.json(
      { error: 'Failed to reorder content sections' },
      { status: 500 }
    )
  }
}

