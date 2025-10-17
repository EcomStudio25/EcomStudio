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
    const { userId, refNo, selectedImages, imageCount, settings } = body;

    // 3. Authorization - Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot generate video for another user' },
        { status: 403 }
      );
    }

    // 4. Validate input
    if (!selectedImages || !Array.isArray(selectedImages) || selectedImages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid selectedImages - Must be a non-empty array' },
        { status: 400 }
      );
    }

    if (selectedImages.length > 4) {
      return NextResponse.json(
        { error: 'Maximum 4 images allowed' },
        { status: 400 }
      );
    }

    // 5. Get webhook URL from server env
    const SAVE_WEBHOOK = process.env.SAVE_WEBHOOK;

    if (!SAVE_WEBHOOK) {
      console.error('❌ Webhook URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 6. Call N8N webhook
    const payload = {
      userId,
      refNo,
      selectedImages,
      imageCount,
      settings,
    };

    const webhookResponse = await fetch(SAVE_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ Webhook call failed:', errorText);
      return NextResponse.json(
        { error: 'Could not start video generation' },
        { status: 500 }
      );
    }

    const result = await webhookResponse.json();

    // 7. Return success response
    return NextResponse.json({
      success: true,
      video_url: result.video_url || null,
      status_url: result.status_url || null,
    });

  } catch (error: any) {
    console.error('❌ Generate Video API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
