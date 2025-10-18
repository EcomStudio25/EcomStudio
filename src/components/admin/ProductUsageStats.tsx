'use client';

import { useState, useEffect } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

interface ProductUsageStatsProps {
  supabase: SupabaseClient;
}

interface Stats {
  totalFavorites: number;
  totalVideos: number;
  totalGeneratedImages: number;
  totalUploadedImages: number;
  totalCredits: number;
}

export default function ProductUsageStats({ supabase }: ProductUsageStatsProps) {
  const [stats, setStats] = useState<Stats>({
    totalFavorites: 0,
    totalVideos: 0,
    totalGeneratedImages: 0,
    totalUploadedImages: 0,
    totalCredits: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Total Favorite Videos
      const { count: favCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('is_favorite', true)
        .eq('file_type', 'video');

      // Total Produced Videos
      const { count: vidCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('folder', 'video-assets')
        .eq('file_type', 'video');

      // Total Generated Images
      const { count: genImgCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('folder', 'image-assets')
        .eq('file_type', 'image');

      // Total Uploaded Images
      const { count: uplImgCount } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('folder', 'uploads')
        .eq('file_type', 'image');

      // Total Credits (sum of all user credits)
      const { data: creditsData } = await supabase
        .from('profiles')
        .select('credits');

      const totalCredits = creditsData?.reduce((sum, profile) => sum + (profile.credits || 0), 0) || 0;

      setStats({
        totalFavorites: favCount || 0,
        totalVideos: vidCount || 0,
        totalGeneratedImages: genImgCount || 0,
        totalUploadedImages: uplImgCount || 0,
        totalCredits
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading stats:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: '#a8a8a8' }}>Loading stats...</div>;
  }

  return (
    <>
      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 20px;
        }

        .stat-card {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 15px;
          padding: 25px 20px;
          text-align: center;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        }

        .stat-number {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 10px;
          color: #ffffff;
        }

        .stat-label {
          font-size: 12px;
          color: #a8a8a8;
          line-height: 1.4;
        }

        @media (max-width: 1200px) {
          .stats-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }

          .stat-card {
            padding: 20px 15px;
          }

          .stat-number {
            font-size: 24px;
          }

          .stat-label {
            font-size: 11px;
          }
        }
      `}</style>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.totalFavorites.toLocaleString('tr-TR')}</div>
          <div className="stat-label">Total Favorite Videos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalVideos.toLocaleString('tr-TR')}</div>
          <div className="stat-label">Total Produced Videos</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalGeneratedImages.toLocaleString('tr-TR')}</div>
          <div className="stat-label">Total Generated Images</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalUploadedImages.toLocaleString('tr-TR')}</div>
          <div className="stat-label">Total Uploaded Images</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.totalCredits.toLocaleString('tr-TR')}</div>
          <div className="stat-label">Total Credits</div>
        </div>
      </div>
    </>
  );
}
