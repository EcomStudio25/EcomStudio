'use client';

import { ReactNode, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { useToast } from './Toast';
import Header from './Header';
import Footer from './Footer';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const router = useRouter();
  const { showVideoReadyToast } = useToast();
  const [supabase] = useState<SupabaseClient>(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const lastCheckedVideoId = useRef<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    setCurrentUser(user);
    setLoading(false);
  };

  // Video status polling - checks every 10 seconds for new completed videos
  useEffect(() => {
    if (!currentUser) return;

    const checkForCompletedVideos = async () => {
      try {
        // Query the most recent video that's completed
        const { data, error } = await supabase
          .from('user_files')
          .select('id, created_at, file_type')
          .eq('user_id', currentUser.id)
          .eq('file_type', 'video')
          .eq('folder', 'video-assets')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error checking videos:', error);
          return;
        }

        if (data && data.length > 0) {
          const latestVideo = data[0];

          // Check if this is a new video we haven't notified about
          if (lastCheckedVideoId.current !== latestVideo.id) {
            // Check if video was created in the last 5 minutes (to avoid old videos)
            const videoAge = Date.now() - new Date(latestVideo.created_at).getTime();
            const fiveMinutes = 5 * 60 * 1000;

            if (videoAge < fiveMinutes && lastCheckedVideoId.current !== null) {
              // Show toast for newly completed video
              console.log('🎬 New video detected, showing toast!');
              showVideoReadyToast();
            }

            lastCheckedVideoId.current = latestVideo.id;
          }
        }
      } catch (err) {
        console.error('Error in video polling:', err);
      }
    };

    // Initial check after 3 seconds
    const initialTimeout = setTimeout(checkForCompletedVideos, 3000);

    // Then check every 10 seconds
    const interval = setInterval(checkForCompletedVideos, 10000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [currentUser, supabase, showVideoReadyToast]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#1b1c1e',
        color: '#fff',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Arial', sans-serif;
          background: #1b1c1e;
          color: #ffffff;
        }
      `}</style>

      <Header supabase={supabase} currentUser={currentUser} />
      
      <main style={{ minHeight: 'calc(100vh - 270px)' }}>
        {children}
      </main>
      
      <Footer />
    </>
  );
}