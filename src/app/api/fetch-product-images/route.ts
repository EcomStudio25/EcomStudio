import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication - Verify the user is logged in
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - No auth token' },
        { status: 401 }
      );
    }

    // Create Supabase client with the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { productUrl } = body;

    // 3. Validate input
    if (!productUrl) {
      return NextResponse.json(
        { error: 'productUrl is required' },
        { status: 400 }
      );
    }

    if (typeof productUrl !== 'string' || !productUrl.includes('http')) {
      return NextResponse.json(
        { error: 'Invalid productUrl - Must be a valid URL' },
        { status: 400 }
      );
    }

    // 4. Get webhook URL from server env
    const FETCH_WEBHOOK = process.env.FETCH_WEBHOOK;

    if (!FETCH_WEBHOOK) {
      console.error('❌ Fetch webhook URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 5. Call N8N fetch webhook
    const payload = {
      productUrl,
    };

    const webhookResponse = await fetch(FETCH_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ Fetch webhook call failed:', errorText);
      return NextResponse.json(
        { error: 'Could not fetch images from URL' },
        { status: 500 }
      );
    }

    const result = await webhookResponse.json();

    // 6. Return fetched images
    return NextResponse.json({
      success: true,
      images: result.images || [],
    });

  } catch (error: any) {
    console.error('❌ Fetch Product Images API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
