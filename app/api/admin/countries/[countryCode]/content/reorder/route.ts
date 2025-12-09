export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { countryContentService } from '@/services/countryContent'

/**
 * Check if the current user is an admin
 */
async function isAdmin(request: NextRequest): Promise<boolean> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false
    }

    const token = authHeader.replace('Bearer ', '')
    
    const cookieStore = cookies()
    const supabase = createServerClient(
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

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return false
    }

    const { data: authorized, error } = await supabase.rpc('authorize', {
      requested_permission: 'content.moderate'
    })

    if (error) {
      return false
    }

    return authorized === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
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
    // Check admin authorization
    const authorized = await isAdmin(request)
    if (!authorized) {
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

    const reorderedSections = await countryContentService.reorderSections(
      countryCode,
      body.sectionIds
    )

    return NextResponse.json(reorderedSections)
  } catch (error) {
    console.error('Error reordering content sections:', error)
    
    return NextResponse.json(
      { error: 'Failed to reorder content sections' },
      { status: 500 }
    )
  }
}

