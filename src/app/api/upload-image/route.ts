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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 3. Authorization - Verify userId matches authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - Cannot upload for another user' },
        { status: 403 }
      );
    }

    // 4. Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type - Only images allowed' },
        { status: 400 }
      );
    }

    // 5. Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large - Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // 6. Generate unique filename
    const timestamp = Date.now();
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const extension = file.name.split('.').pop();
    const filename = `computer_${timestamp}_${randomNum}.${extension}`;

    // 7. Get Bunny CDN credentials from server env
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

    // 8. Upload to Bunny CDN
    const uploadUrl = `${BUNNY_STORAGE_URL}/user-${userId}/uploads/${filename}`;

    const fileBuffer = await file.arrayBuffer();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_ACCESS_KEY,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Bunny CDN upload failed:', errorText);
      return NextResponse.json(
        { error: 'Upload failed' },
        { status: 500 }
      );
    }

    // 9. Generate CDN URL
    const cdnUrl = `${BUNNY_CDN_URL}/user-${userId}/uploads/${filename}`;

    // 10. Return success response
    return NextResponse.json({
      success: true,
      url: cdnUrl,
      filename: filename,
    });

  } catch (error: any) {
    console.error('❌ Upload API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
