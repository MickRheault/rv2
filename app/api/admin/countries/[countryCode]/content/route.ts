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
 * GET /api/admin/countries/[countryCode]/content
 * Fetch all content sections for a country
 */
export async function GET(
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

    // Fetch content sections from database
    const { data, error } = await supabase
      .from('countries')
      .select('content_sections')
      .eq('code', countryCode)
      .single()

    if (error) {
      console.error('Error fetching content sections:', error)
      return NextResponse.json(
        { error: 'Failed to fetch content sections' },
        { status: 500 }
      )
    }

    const sections = (data?.content_sections as unknown as ContentSection[]) || []
    return NextResponse.json(sections)
  } catch (error) {
    console.error('Error fetching content sections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch content sections' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/countries/[countryCode]/content
 * Add a new content section
 */
export async function POST(
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

    // Validate required fields
    if (!body.title || !body.content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    // Validate field lengths
    if (body.title.length > 200) {
      return NextResponse.json(
        { error: 'Title cannot exceed 200 characters' },
        { status: 400 }
      )
    }

    if (body.content.length > 100000) {
      return NextResponse.json(
        { error: 'Content cannot exceed 100,000 characters' },
        { status: 400 }
      )
    }

    // Validate order if provided
    if (body.order !== undefined && (body.order < 0 || !Number.isInteger(body.order))) {
      return NextResponse.json(
        { error: 'Order must be a positive integer' },
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

    // Create new section
    const newSection: ContentSection = {
      id: crypto.randomUUID(),
      title: body.title,
      content: body.content,
      order: body.order || (existingSections.length + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Append to existing sections
    const updatedSections = [...existingSections, newSection]

    // Update database
    const { error: updateError } = await supabase
      .from('countries')
      .update({ content_sections: updatedSections as any })
      .eq('code', countryCode)

    if (updateError) {
      console.error('Error saving content section:', updateError)
      return NextResponse.json(
        { error: 'Failed to save content section' },
        { status: 500 }
      )
    }

    return NextResponse.json(newSection, { status: 201 })
  } catch (error) {
    console.error('Error adding content section:', error)
    return NextResponse.json(
      { error: 'Failed to add content section' },
      { status: 500 }
    )
  }
}

