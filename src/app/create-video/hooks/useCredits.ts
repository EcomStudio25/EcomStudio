'use client';

import { useState, useCallback, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface PricingSettings {
  credit_per_image: number;
  discount_rate: number;
}

export function useCredits(supabase: SupabaseClient, userId: string | null) {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState<PricingSettings>({
    credit_per_image: 100,
    discount_rate: 0
  });

  // Load pricing settings from admin_settings
  const loadPricingSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['credit_per_image', 'discount_rate']);

      if (error) throw error;

      if (data) {
        const settings: any = {};
        data.forEach((item) => {
          settings[item.setting_key] = parseFloat(item.setting_value);
        });

        setPricing({
          credit_per_image: settings.credit_per_image || 100,
          discount_rate: settings.discount_rate || 0
        });
      }
    } catch (error) {
      console.error('Error loading pricing settings:', error);
      // Use default values if settings can't be loaded
      setPricing({
        credit_per_image: 100,
        discount_rate: 0
      });
    }
  }, [supabase]);

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

  // Calculate actual credit cost per image with discount applied
  const calculateCreditPerImage = useCallback((): number => {
    const basePrice = pricing.credit_per_image;
    const discountMultiplier = (100 - pricing.discount_rate) / 100;
    return Math.round(basePrice * discountMultiplier);
  }, [pricing]);

  const checkCredits = useCallback(
    (imageCount: number): boolean => {
      const creditPerImage = calculateCreditPerImage();
      const requiredCredits = imageCount * creditPerImage;
      return credits >= requiredCredits;
    },
    [credits, calculateCreditPerImage]
  );

  const deductCredits = useCallback(
    async (imageCount: number): Promise<boolean> => {
      if (!userId) return false;

      const creditPerImage = calculateCreditPerImage();
      const requiredCredits = imageCount * creditPerImage;

      if (credits < requiredCredits) {
        return false;
      }

      try {
        const newCredits = credits - requiredCredits;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ credits: newCredits })
          .eq('id', userId);

        if (updateError) throw updateError;

        // Record transaction
        const { error: transError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            description: 'Video Generation',
            amount: -requiredCredits,
            images_count: imageCount,
            transaction_type: 'video_generation'
          });

        if (transError) {
          console.error('Error recording transaction:', transError);
          // Don't fail the whole operation if transaction recording fails
        }

        setCredits(newCredits);
        return true;
      } catch (error) {
        console.error('Error deducting credits:', error);
        return false;
      }
    },
    [supabase, userId, credits, calculateCreditPerImage]
  );

  // Auto-load pricing settings and credits when component mounts
  useEffect(() => {
    loadPricingSettings();
  }, [loadPricingSettings]);

  useEffect(() => {
    if (userId) {
      loadCredits();
    }
  }, [userId, loadCredits]);

  return {
    credits,
    loading,
    pricing,
    creditPerImage: calculateCreditPerImage(),
    loadCredits,
    checkCredits,
    deductCredits,
    reloadPricing: loadPricingSettings
  };
}
