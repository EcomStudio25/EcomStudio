'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';

interface DashboardContentProps {
  supabase: SupabaseClient;
  currentUser: User | null;
}

interface Stats {
  favorites: number;
  videos: number;
  images: number;
  uploads: number;
}

interface UserFile {
  id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: 'image' | 'video';
  folder: string;
  file_size: number;
  is_favorite: boolean;
  is_viewed: boolean;
  created_at: string;
}

interface LightboxData {
  url: string;
  type: 'image' | 'video';
}

export default function DashboardContent({ supabase, currentUser }: DashboardContentProps) {
  const router = useRouter();
  const { showToast, showVideoReadyToast } = useToast();
  
  const [stats, setStats] = useState<Stats>({
    favorites: 0,
    videos: 0,
    images: 0,
    uploads: 0
  });
  
  const [credits, setCredits] = useState<number>(0);
  const [latestVideos, setLatestVideos] = useState<UserFile[]>([]);
  const [latestImages, setLatestImages] = useState<UserFile[]>([]);
  const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);

  useEffect(() => {
    if (currentUser && supabase) {
      loadDashboardData();
    }
  }, [currentUser, supabase]);

  const loadDashboardData = async (): Promise<void> => {
    await Promise.all([
      loadStats(),
      loadCredits(),
      loadLatestVideos(),
      loadLatestImages()
    ]);
  };

  const loadStats = async (): Promise<void> => {
    try {
      // Favorites Count
      const { count: favCount, error: favError } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser!.id)
        .eq('is_favorite', true)
        .eq('file_type', 'video');

      if (favError) throw favError;

      // Videos Count
      const { count: vidCount, error: vidError } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser!.id)
        .eq('folder', 'video-assets');

      if (vidError) throw vidError;

      // Images Count
      const { count: imgCount, error: imgError } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser!.id)
        .eq('folder', 'image-assets');

      if (imgError) throw imgError;

      // Uploads Count
      const { count: uplCount, error: uplError } = await supabase
        .from('user_files')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser!.id)
        .eq('folder', 'uploads');

      if (uplError) throw uplError;

      setStats({
        favorites: favCount || 0,
        videos: vidCount || 0,
        images: imgCount || 0,
        uploads: uplCount || 0
      });
    } catch (error) {
      const appError = handleError(error, 'loadStats');
      showToast(appError.userMessage, 'error');
      setStats({
        favorites: 0,
        videos: 0,
        images: 0,
        uploads: 0
      });
    }
  };

  const loadCredits = async (): Promise<void> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', currentUser!.id)
        .single();

      if (error) throw error;

      if (profile) {
        setCredits(profile.credits || 0);
      }
    } catch (error) {
      const appError = handleError(error, 'loadCredits');
      showToast(appError.userMessage, 'error');
      setCredits(0);
    }
  };

  const loadLatestVideos = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', currentUser!.id)
        .eq('folder', 'video-assets')
        .eq('file_type', 'video')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      setLatestVideos((data as UserFile[]) || []);
    } catch (error) {
      const appError = handleError(error, 'loadLatestVideos');
      showToast(appError.userMessage, 'error');
      setLatestVideos([]);
    }
  };

  const loadLatestImages = async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', currentUser!.id)
        .eq('folder', 'image-assets')
        .eq('file_type', 'image')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      setLatestImages((data as UserFile[]) || []);
    } catch (error) {
      const appError = handleError(error, 'loadLatestImages');
      showToast(appError.userMessage, 'error');
      setLatestImages([]);
    }
  };

  const getBunnyCDNUrl = (filePath: string, folder: string): string => {
    if (!currentUser) return filePath;
    const fileName = filePath.split('/').pop();
    return `https://ess25.b-cdn.net/user-${currentUser.id}/${folder}/${fileName}`;
  };

  const openLightbox = async (url: string, type: 'image' | 'video', fileId?: string): Promise<void> => {
    setLightboxData({ url, type });

    // Mark video as viewed if fileId is provided
    if (fileId && type === 'video') {
      try {
        await supabase
          .from('user_files')
          .update({ is_viewed: true })
          .eq('id', fileId);

        // Update local state
        setLatestVideos(prev =>
          prev.map(video =>
            video.id === fileId ? { ...video, is_viewed: true } : video
          )
        );
      } catch (error) {
        console.error('Error marking video as viewed:', error);
      }
    }
  };

  const closeLightbox = (): void => {
    setLightboxData(null);
  };

  return (
    <>
      <style jsx>{`
        .content-wrapper {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .stats-container {
          height: 180px;
          width: 100%;
          background: linear-gradient(to bottom, #313237, #1e1f22);
          border-radius: 20px;
          border: 2px solid #292a2e;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 50px;
          gap: 40px;
          position: relative;
          overflow: hidden;
        }

        .stats-left {
          display: flex;
          flex-direction: column;
          gap: 15px;
          z-index: 2;
        }

        .stats-title {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #ffffff;
          margin-bottom: 5px;
        }

        .stats-items {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          background: transparent;
          min-width: 80px;
        }

        .stat-icon {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          opacity: 0.9;
        }

        .stat-number {
          font-size: 28px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
          letter-spacing: -0.5px;
        }

        .stat-label {
          font-size: 13px;
          color: #cccccc;
          font-weight: 500;
          line-height: 1.3;
          white-space: nowrap;
        }

        .stats-center {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          height: 100%;
        }

        .banner-wave {
          height: 180px;
          width: 100%;
          max-width: 600px;
        }

        .banner-wave img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .stats-right {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 8px;
          z-index: 2;
          min-width: 140px;
        }

        .credits-label {
          font-size: 12px;
          color: #cccccc;
          font-weight: 500;
        }

        .credits-value {
          font-size: 48px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1;
          letter-spacing: -1px;
        }

        .credits-link {
          color: #ffffff;
          text-decoration: underline;
          font-size: 13px;
          cursor: pointer;
          transition: opacity 0.3s;
          font-weight: 500;
          margin-top: 5px;
        }

        .credits-link:hover {
          opacity: 0.7;
        }

        .cta-section {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
        }

        .cta-button {
          height: 180px;
          background: url('/stats_bg.jpg') repeat;
          border-radius: 20px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }

        .cta-button:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
        }

        .cta-button h2 {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 1px;
          color: #ffffff;
          text-align: center;
          line-height: 1.3;
          z-index: 2;
        }

        .gallery-section {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
        }

        .gallery-card {
          background: transparent;
          border: 2px solid #313237;
          border-radius: 20px;
          padding: 35px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .gallery-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #cccccc;
          text-align: center;
          margin-bottom: 30px;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .gallery-item {
          aspect-ratio: 3/4;
          border-radius: 15px;
          overflow: visible;
          position: relative;
          cursor: pointer;
          transition: all 0.3s;
          background: #1a1a1a;
        }

        .gallery-item:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
        }

        .gallery-item.new-item {
          border: 5px solid #27a600;
          box-sizing: border-box;
        }

        .gallery-item-content {
          width: 100%;
          height: 100%;
          border-radius: 15px;
          overflow: hidden;
        }

        .gallery-item img,
        .gallery-item video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .gallery-item-overlay {
          position: absolute;
          bottom: 10px;
          right: 10px;
          width: 32px;
          height: 32px;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 50%;
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gallery-item-overlay svg {
          width: 16px;
          height: 16px;
          fill: #fff;
        }

        .new-item-badge {
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          width: 100px;
          height: 100px;
          pointer-events: none;
          z-index: 10;
        }

        .new-item-badge img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .empty-gallery {
          text-align: center;
          padding: 40px;
          color: #666;
          grid-column: 1 / -1;
        }

        .lightbox {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 9999;
          align-items: center;
          justify-content: center;
        }

        .lightbox.active {
          display: flex;
        }

        .lightbox-content {
          max-width: 90%;
          max-height: 90%;
          position: relative;
        }

        .lightbox-content img,
        .lightbox-content video {
          max-width: 90vw;
          max-height: 90vh;
          border-radius: 8px;
        }

        .lightbox-close {
          position: absolute;
          top: 20px;
          right: 20px;
          width: 40px;
          height: 40px;
          background: #ffffff;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }

        .lightbox-close:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 15px rgba(255, 255, 255, 0.3);
        }

        .lightbox-close svg {
          width: 20px;
          height: 20px;
        }

        .lightbox-close svg path {
          stroke: #000;
        }

        @media (max-width: 1200px) {
          .stats-container {
            padding: 0 30px;
            gap: 30px;
          }

          .cta-section,
          .gallery-section {
            gap: 30px;
          }

          .gallery-grid {
            gap: 15px;
          }
        }

        @media (max-width: 900px) {
          .stats-container {
            height: auto;
            min-height: 180px;
            flex-direction: column;
            padding: 30px 20px;
            gap: 25px;
          }

          .stats-items {
            justify-content: center;
            flex-wrap: wrap;
          }

          .banner-wave {
            max-width: 100%;
            height: auto;
          }

          .banner-wave img {
            height: auto;
          }

          .cta-section,
          .gallery-section {
            grid-template-columns: 1fr;
            gap: 30px;
          }

          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .content-wrapper {
            padding: 20px 10px;
            gap: 30px;
          }

          .stats-container,
          .cta-button,
          .gallery-card {
            border-radius: 15px;
          }

          .stat-number {
            font-size: 22px;
          }

          .stat-label {
            font-size: 11px;
          }

          .credits-value {
            font-size: 36px;
          }

          .cta-button h2 {
            font-size: 24px;
          }

          .gallery-title {
            font-size: 18px;
          }

          .gallery-card {
            padding: 25px;
          }

          .new-item-badge {
            width: 60px;
            height: 60px;
          }
        }
      `}</style>

      <div className="content-wrapper">
        {/* Stats Section */}
        <section className="stats-container">
          <div className="stats-left">
            <div className="stats-title">YOU HAVE</div>
            <div className="stats-items">
              <div className="stat-item">
                <div className="stat-icon">
                  <img src="/icon_star.png" alt="Star" />
                </div>
                <div className="stat-number">{stats.favorites}</div>
                <div className="stat-label">Favorite<br />Videos</div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <img src="/icon_play.png" alt="Play" />
                </div>
                <div className="stat-number">{stats.videos}</div>
                <div className="stat-label">Produced<br />Videos</div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <img src="/icon_image.png" alt="Image" />
                </div>
                <div className="stat-number">{stats.images}</div>
                <div className="stat-label">Generated<br />Images</div>
              </div>
              <div className="stat-item">
                <div className="stat-icon">
                  <img src="/icon_upload.png" alt="Upload" />
                </div>
                <div className="stat-number">{stats.uploads.toLocaleString('tr-TR')}</div>
                <div className="stat-label">Uploaded<br />Images</div>
              </div>
            </div>
          </div>
          <div className="stats-center">
            <div className="banner-wave">
              <img src="/DB_Banner.jpg" alt="Simple Moves, Big Results" />
            </div>
          </div>
          <div className="stats-right">
            <div className="credits-label">Total Credits:</div>
            <div className="credits-value">{credits.toLocaleString('tr-TR')}</div>
            <a 
              onClick={() => router.push('/user-settings-credits')} 
              className="credits-link"
            >
              +Add Credits
            </a>
          </div>
        </section>

        {/* CTA Buttons */}
        <section className="cta-section">
          <div 
            className="cta-button" 
            onClick={() => router.push('/create-video')}
          >
            <h2>LET'S START<br />CREATING VIDEOS</h2>
          </div>
          <div className="cta-button">
            <h2>LET'S START<br />CREATING IMAGES</h2>
          </div>
        </section>

        {/* Gallery Cards */}
        <section className="gallery-section">
          <div className="gallery-card">
            <h3 className="gallery-title">LATEST VIDEOS</h3>
            <div className="gallery-grid">
              {latestVideos.length === 0 ? (
                <div className="empty-gallery">No videos yet</div>
              ) : (
                latestVideos.map((video) => {
                  const videoUrl = getBunnyCDNUrl(video.file_path, 'video-assets');
                  return (
                    <div
                      key={video.id}
                      className={`gallery-item ${video.is_viewed === false ? 'new-item' : ''}`}
                      onClick={() => openLightbox(videoUrl, 'video', video.id)}
                    >
                      <div className="gallery-item-content">
                        <video src={videoUrl} preload="metadata"></video>
                        <div className="gallery-item-overlay">
                          <svg viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" fill="currentColor" />
                          </svg>
                        </div>
                      </div>
                      {video.is_viewed === false && (
                        <div className="new-item-badge">
                          <img src="/icon_new_video.png" alt="New" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="gallery-card">
            <h3 className="gallery-title">LATEST IMAGES</h3>
            <div className="gallery-grid">
              {latestImages.length === 0 ? (
                <div className="empty-gallery">No images yet</div>
              ) : (
                latestImages.map((image) => {
                  const imageUrl = getBunnyCDNUrl(image.file_path, 'image-assets');
                  return (
                    <div
                      key={image.id}
                      className={`gallery-item ${image.is_viewed === false ? 'new-item' : ''}`}
                      onClick={() => openLightbox(imageUrl, 'image')}
                    >
                      <div className="gallery-item-content">
                        <img src={imageUrl} alt={image.file_name} />
                      </div>
                      {image.is_viewed === false && (
                        <div className="new-item-badge">
                          <img src="/icon_new_img.png" alt="New" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox */}
      <div className={`lightbox ${lightboxData ? 'active' : ''}`} onClick={closeLightbox}>
        <button className="lightbox-close" onClick={closeLightbox}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
          {lightboxData && lightboxData.type === 'video' ? (
            <video src={lightboxData.url} controls autoPlay />
          ) : lightboxData ? (
            <img src={lightboxData.url} alt="Full size" />
          ) : null}
        </div>
      </div>
    </>
  );
}