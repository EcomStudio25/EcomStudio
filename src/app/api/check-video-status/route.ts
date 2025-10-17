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
    const { userId, status_url, refNo } = body;

    // 3. Authorization - Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot check status for another user' },
        { status: 403 }
      );
    }

    // 4. Validate input
    if (!status_url || !refNo) {
      return NextResponse.json(
        { error: 'status_url and refNo are required' },
        { status: 400 }
      );
    }

    // 5. Get webhook URL from server env
    const STATUS_WEBHOOK = process.env.STATUS_WEBHOOK;

    if (!STATUS_WEBHOOK) {
      console.error('❌ Status webhook URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 6. Call N8N status webhook
    const payload = {
      status_url,
      refNo,
      userId,
    };

    const webhookResponse = await fetch(STATUS_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ Status webhook call failed:', errorText);
      return NextResponse.json(
        { error: 'Status check failed' },
        { status: 500 }
      );
    }

    const result = await webhookResponse.json();

    // 7. Return status response
    return NextResponse.json({
      success: true,
      status: result.status,
      video_url: result.video_url || null,
    });

  } catch (error: any) {
    console.error('❌ Check Video Status API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
