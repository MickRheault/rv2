import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server'; // Ensure correct import for server-side auth check
import { ShopManifest } from '@/types/shop-manifest';

export async function POST(req: NextRequest) {
  // Initialize OpenAI client lazily to avoid build-time errors if env var is missing
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // 1. Auth Check (Server-Side)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse Request
  const { url } = await req.json();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    // 3. Fetch Page Content
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const html = await response.text();

    // Truncate HTML to avoid token limits (adjust as needed)
    const truncatedHtml = html.slice(0, 100000); 

    // 4. LLM Extraction
    const prompt = `
      You are an expert data extraction assistant.
      Extract motorcycle rental shop details and inventory from the following HTML content.
      Return the result as a valid JSON object matching this TypeScript interface:

      interface ShopManifest {
        shop: {
          provider_name: string;
          slug?: string; // URL-friendly string
          city: string; // City name, e.g. "Bangkok"
          address?: string;
          phone?: string;
          website?: string;
          google_maps_url?: string;
          latitude?: number;
          longitude?: number;
          rating?: number;
          review_count?: number;
          inclusions?: string[]; // e.g. ["Helmet", "Phone Holder"]
          conditions?: Record<string, string>; // e.g. { "deposit": "2000 THB" }
        };
        inventory: {
          defaults?: {
            currency?: string;
            status?: 'AVAILABLE' | 'UNAVAILABLE';
          };
          items: Array<{
            model: string;
            brand: string; // Brand name, e.g. "Honda"
            category: string; // Category name, e.g. "Scooter"
            cc?: number;
            year?: number;
            daily_rate?: number;
            qty?: number; // default 1
            source_url?: string;
          }>;
        };
      }

      HTML Content:
      ${truncatedHtml}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use a cost-effective model
      messages: [
        { role: "system", content: "You are a helpful assistant that extracts structured data from HTML." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const manifestJson = completion.choices[0].message.content;
    if (!manifestJson) {
      throw new Error("LLM returned empty response");
    }

    const manifest = JSON.parse(manifestJson) as ShopManifest;

    return NextResponse.json({ manifest });

  } catch (error: any) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
