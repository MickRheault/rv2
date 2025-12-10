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
async function createAuthenticatedSupabaseClient(token: string) {
  const cookieStore = await cookies()
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
    const supabase = await createAuthenticatedSupabaseClient(token)

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
 * PUT /api/admin/countries/[countryCode]/content/[sectionId]
 * Update a specific content section
 */
export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ countryCode: string; sectionId: string }> }
) {
  try {
    // Get authenticated Supabase client
    const supabase = await getAuthenticatedClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await segmentData.params
    const { countryCode, sectionId } = params

    // Validate parameters
    if (!countryCode || countryCode.length < 2) {
      return NextResponse.json(
        { error: 'Invalid country code' },
        { status: 400 }
      )
    }

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Section ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()

    // Validate field lengths if provided
    if (body.title && body.title.length > 200) {
      return NextResponse.json(
        { error: 'Title cannot exceed 200 characters' },
        { status: 400 }
      )
    }

    if (body.content && body.content.length > 100000) {
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

    // Find the section to update
    const sectionIndex = existingSections.findIndex(s => s.id === sectionId)
    if (sectionIndex === -1) {
      return NextResponse.json(
        { error: `Section with id ${sectionId} not found` },
        { status: 404 }
      )
    }

    // Update the section
    const updatedSection: ContentSection = {
      ...existingSections[sectionIndex],
      ...body,
      id: sectionId, // Ensure ID doesn't change
      createdAt: existingSections[sectionIndex].createdAt, // Preserve creation date
      updatedAt: new Date().toISOString(),
    }

    // Replace in array
    const updatedSections = [...existingSections]
    updatedSections[sectionIndex] = updatedSection

    // Update database
    const { error: updateError } = await supabase
      .from('countries')
      .update({ content_sections: updatedSections as any })
      .eq('code', countryCode)

    if (updateError) {
      console.error('Error updating content section:', updateError)
      return NextResponse.json(
        { error: 'Failed to update content section' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedSection)
  } catch (error) {
    console.error('Error updating content section:', error)
    return NextResponse.json(
      { error: 'Failed to update content section' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/countries/[countryCode]/content/[sectionId]
 * Delete a specific content section
 */
export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ countryCode: string; sectionId: string }> }
) {
  try {
    // Get authenticated Supabase client
    const supabase = await getAuthenticatedClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = await segmentData.params
    const { countryCode, sectionId } = params

    // Validate parameters
    if (!countryCode || countryCode.length < 2) {
      return NextResponse.json(
        { error: 'Invalid country code' },
        { status: 400 }
      )
    }

    if (!sectionId) {
      return NextResponse.json(
        { error: 'Section ID is required' },
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

    // Filter out the section to delete
    const updatedSections = existingSections.filter(s => s.id !== sectionId)

    // Check if section was found
    if (updatedSections.length === existingSections.length) {
      return NextResponse.json(
        { error: `Section with id ${sectionId} not found` },
        { status: 404 }
      )
    }

    // Update database (set to null if no sections remain)
    const { error: updateError } = await supabase
      .from('countries')
      .update({ content_sections: updatedSections.length > 0 ? updatedSections as any : null })
      .eq('code', countryCode)

    if (updateError) {
      console.error('Error deleting content section:', updateError)
      return NextResponse.json(
        { error: 'Failed to delete content section' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting content section:', error)
    return NextResponse.json(
      { error: 'Failed to delete content section' },
      { status: 500 }
    )
  }
}

