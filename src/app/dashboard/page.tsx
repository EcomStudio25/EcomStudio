'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import DashboardContent from '@/components/DashboardContent';

export default function DashboardPage() {
  const router = useRouter();
  const { showToast, showVideoReadyToast } = useToast();
  
  const [supabase] = useState<SupabaseClient>(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async (): Promise<void> => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) {
        router.push('/login');
        return;
      }
      setCurrentUser(user);
      setLoading(false);
    } catch (error) {
      const appError = handleError(error, 'checkAuth');
      showToast(appError.userMessage, 'error');
      router.push('/login');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#1b1c1e',
        color: '#fff'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
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

      <DashboardContent supabase={supabase} currentUser={currentUser} />
    </AuthenticatedLayout>
  );
}