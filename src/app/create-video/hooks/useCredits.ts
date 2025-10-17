'use client';

import { useState, useCallback, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

export function useCredits(supabase: SupabaseClient, userId: string | null) {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadCredits = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setCredits(profile?.credits || 0);
    } catch (error) {
      console.error('Error loading credits:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  const checkCredits = useCallback(
    (imageCount: number): boolean => {
      const requiredCredits = imageCount * 100;
      return credits >= requiredCredits;
    },
    [credits]
  );

  const deductCredits = useCallback(
    async (imageCount: number): Promise<boolean> => {
      if (!userId) return false;

      const requiredCredits = imageCount * 100;

      if (credits < requiredCredits) {
        return false;
      }

      try {
        const newCredits = credits - requiredCredits;

        const { error } = await supabase
          .from('profiles')
          .update({ credits: newCredits })
          .eq('id', userId);

        if (error) throw error;

        setCredits(newCredits);
        return true;
      } catch (error) {
        console.error('Error deducting credits:', error);
        return false;
      }
    },
    [supabase, userId, credits]
  );

  // Auto-load credits when userId changes
  useEffect(() => {
    if (userId) {
      loadCredits();
    }
  }, [userId, loadCredits]);

  return {
    credits,
    loading,
    loadCredits,
    checkCredits,
    deductCredits,
  };
}
