'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import MethodSelector from './components/MethodSelector';
import FromComputer from './components/FromComputer';
import FromLibrary from './components/FromLibrary';
import FromURL from './components/FromURL';
import BatchProcessing from './components/BatchProcessing';
import { useCredits } from './hooks/useCredits';

export default function CreateVideoPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentMethod, setCurrentMethod] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const { checkCredits, deductCredits } = useCredits(supabase, currentUserId);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) {
        router.push('/login');
        return;
      }

      setCurrentUserId(user.id);
      setLoading(false);
    } catch (error) {
      const appError = handleError(error, 'loadUserProfile');
      showToast(appError.userMessage, 'error');
      setLoading(false);
    }
  };

  const handleSelectMethod = (method: string) => {
    // Allow method switching even during processing
    // User can change method but won't be able to generate video until current one finishes
    setCurrentMethod(method);
  };

  const handleGenerateStart = () => {
    // Video generation started - handled by child components
  };

  const handleGenerateEnd = () => {
    // Video generation ended - handled by child components
  };

  const handleDeductCredits = async (imageCount: number): Promise<boolean> => {
    const hasEnough = checkCredits(imageCount);
    if (!hasEnough) {
      return false;
    }

    const success = await deductCredits(imageCount);
    if (!success) {
      showToast('Failed to deduct credits. Please try again.', 'error');
      return false;
    }

    return true;
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '50vh',
            color: '#fff',
          }}
        >
          Loading...
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container">
        <MethodSelector
          currentMethod={currentMethod}
          onSelectMethod={handleSelectMethod}
        />

        {currentMethod === 'computer' && (
          <FromComputer
            supabase={supabase}
            userId={currentUserId}
            onGenerateStart={handleGenerateStart}
            onGenerateEnd={handleGenerateEnd}
            onDeductCredits={handleDeductCredits}
          />
        )}

        {currentMethod === 'library' && (
          <FromLibrary
            supabase={supabase}
            userId={currentUserId}
            onGenerateStart={handleGenerateStart}
            onGenerateEnd={handleGenerateEnd}
            onDeductCredits={handleDeductCredits}
          />
        )}

        {currentMethod === 'url' && (
          <FromURL
            supabase={supabase}
            userId={currentUserId}
            onGenerateStart={handleGenerateStart}
            onGenerateEnd={handleGenerateEnd}
            onDeductCredits={handleDeductCredits}
          />
        )}

        {currentMethod === 'batch' && (
          <BatchProcessing
            supabase={supabase}
            userId={currentUserId}
            onGenerateStart={handleGenerateStart}
            onGenerateEnd={handleGenerateEnd}
            onDeductCredits={handleDeductCredits}
          />
        )}
      </div>

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
        }
      `}</style>
    </AuthenticatedLayout>
  );
}
