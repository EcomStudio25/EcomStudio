import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface FolderResult {
  folder: string;
  success: boolean;
  error?: string;
}

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
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 3. Authorization - Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot create folders for another user' },
        { status: 403 }
      );
    }

    // 4. Get Bunny CDN credentials (now secure, server-side only)
    const BUNNY_API_KEY = process.env.BUNNY_API_KEY;
    const BUNNY_BASE_URL = process.env.BUNNY_BASE_URL;

    if (!BUNNY_API_KEY || !BUNNY_BASE_URL) {
      console.error('❌ Bunny CDN credentials not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // 5. Define folders to create
    const folders = [
      `user-${userId}/uploads`,
      `user-${userId}/image-assets`,
      `user-${userId}/video-assets`
    ];

    const results: FolderResult[] = [];

    for (const folder of folders) {
      try {
        const response = await fetch(`${BUNNY_BASE_URL}/${folder}/`, {
          method: 'PUT',
          headers: {
            'AccessKey': BUNNY_API_KEY,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok || response.status === 201) {
          results.push({ folder, success: true });
          console.log(`✅ Folder created: ${folder}`);
        } else {
          const errorText = await response.text();
          results.push({ folder, success: false, error: errorText });
          console.error(`❌ Folder creation failed: ${folder}`, errorText);
        }
      } catch (error: any) {
        results.push({ folder, success: false, error: error.message });
        console.error(`❌ Error creating folder: ${folder}`, error);
      }
    }

    const allSuccess = results.every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      results,
      message: allSuccess 
        ? 'All folders created successfully' 
        : 'Some folders could not be created'
    });

  } catch (error: any) {
    console.error('❌ API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}