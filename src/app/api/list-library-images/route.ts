import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // 2. Get userId from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }

    // 3. Authorization - Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot access another user\'s library' },
        { status: 403 }
      );
    }

    // 4. Get Bunny CDN credentials from server env
    const BUNNY_STORAGE_URL = process.env.BUNNY_STORAGE_URL;
    const BUNNY_ACCESS_KEY = process.env.BUNNY_ACCESS_KEY;
    const BUNNY_CDN_URL = process.env.BUNNY_CDN_URL;

    if (!BUNNY_STORAGE_URL || !BUNNY_ACCESS_KEY || !BUNNY_CDN_URL) {
      console.error('❌ Bunny CDN credentials not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 5. Fetch library from Bunny CDN
    const listUrl = `${BUNNY_STORAGE_URL}/user-${userId}/uploads/`;

    const response = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_ACCESS_KEY
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Bunny CDN list failed:', errorText);
      return NextResponse.json(
        { error: 'Could not load library' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // 6. Filter and format image data
    const images = data
      .filter(
        (file: any) =>
          !file.IsDirectory &&
          file.ObjectName.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      )
      .map((file: any) => ({
        url: `${BUNNY_CDN_URL}/user-${userId}/uploads/${file.ObjectName}`,
        thumbnail: `${BUNNY_CDN_URL}/user-${userId}/uploads/${file.ObjectName}`,
        name: file.ObjectName,
        date: file.LastChanged,
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      );

    // 7. Return success response
    return NextResponse.json({
      success: true,
      images: images,
      count: images.length,
    });

  } catch (error: any) {
    console.error('❌ List Library API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
