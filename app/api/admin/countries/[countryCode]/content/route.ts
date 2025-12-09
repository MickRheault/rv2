export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { countryContentService } from '@/services/countryContent'
import { ContentSection } from '@/types'

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
 * GET /api/admin/countries/[countryCode]/content
 * Fetch all content sections for a country
 */
export async function GET(
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

    const sections = await countryContentService.getContentSections(countryCode)
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

    const newSection = await countryContentService.addContentSection(countryCode, {
      title: body.title,
      content: body.content,
      order: body.order || 1,
    })

    return NextResponse.json(newSection, { status: 201 })
  } catch (error) {
    console.error('Error adding content section:', error)
    
    // Check if it's a validation error
    if (error instanceof Error && error.message.includes('Validation failed')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to add content section' },
      { status: 500 }
    )
  }
}

