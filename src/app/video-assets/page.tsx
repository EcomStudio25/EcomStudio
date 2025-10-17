'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function VideoAssetsPage() {
  const { showToast } = useToast();
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allVideos, setAllVideos] = useState<any[]>([]);
  const [displayedVideos, setDisplayedVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxVideo, setLightboxVideo] = useState('');

  const ITEMS_PER_PAGE = 18;

  useEffect(() => {
    loadUserAndVideos();
  }, []);

  const loadUserAndVideos = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) return;
      
      setCurrentUser(user);
      await loadVideos('newest', user);
    } catch (error) {
      const appError = handleError(error, 'loadUserAndVideos');
      showToast(appError.userMessage, 'error');
    }
  };

  const getBunnyCDNUrl = (filePath: string, folder = 'video-assets') => {
    if (!currentUser) return filePath;
    const fileName = filePath.split('/').pop();
    return `https://ess25.b-cdn.net/user-${currentUser.id}/${folder}/${fileName}`;
  };

  const loadVideos = async (sortOption: string, user: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('folder', 'video-assets')
        .eq('file_type', 'video');

      if (error) throw error;

      const videos = (data || []).map((video: any) => ({
        ...video,
        is_viewed: video.is_viewed ?? false,
        is_favorite: video.is_favorite ?? false
      }));
      
      const sortedVideos = sortVideosArray(videos, sortOption);
      setAllVideos(sortedVideos);
      setDisplayedVideos(sortedVideos.slice(0, ITEMS_PER_PAGE));
      setCurrentPage(0);
    } catch (error) {
      const appError = handleError(error, 'loadVideos');
      showToast(appError.userMessage, 'error');
      setAllVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const sortVideosArray = (videos: any[], sortOption: string) => {
    const sorted = [...videos];
    switch(sortOption) {
      case 'newest':
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'name_asc':
        return sorted.sort((a, b) => a.file_name.localeCompare(b.file_name));
      case 'name_desc':
        return sorted.sort((a, b) => b.file_name.localeCompare(a.file_name));
      case 'size_desc':
        return sorted.sort((a, b) => b.file_size - a.file_size);
      case 'size_asc':
        return sorted.sort((a, b) => a.file_size - b.file_size);
      default:
        return sorted;
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSort = e.target.value;
    setSortBy(newSort);
    if (currentUser) {
      loadVideos(newSort, currentUser);
    }
  };

  const markAsViewed = async (videoId: string) => {
    try {
      const { error } = await supabase
        .from('user_files')
        .update({ is_viewed: true })
        .eq('id', videoId);
      
      if (error) throw error;
      
      setAllVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, is_viewed: true } : v
      ));
      setDisplayedVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, is_viewed: true } : v
      ));
    } catch (error) {
      const appError = handleError(error, 'markAsViewed');
      console.error(appError.message);
    }
  };

  const toggleFavorite = async (videoId: string) => {
    const video = allVideos.find(v => v.id === videoId);
    if (!video) return;
    
    const newFavoriteState = !video.is_favorite;
    
    try {
      const { error } = await supabase
        .from('user_files')
        .update({ is_favorite: newFavoriteState })
        .eq('id', videoId);
      
      if (error) throw error;
      
      setAllVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, is_favorite: newFavoriteState } : v
      ));
      setDisplayedVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, is_favorite: newFavoriteState } : v
      ));
      
      const message = newFavoriteState 
        ? 'Added to favorites!' 
        : 'Removed from favorites!';
      showToast(message, 'success');
    } catch (error) {
      const appError = handleError(error, 'toggleFavorite');
      showToast(appError.userMessage, 'error');
    }
  };

  const downloadVideo = (url: string, filename: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showToast('Download started!', 'success');
    } catch (error) {
      const appError = handleError(error, 'downloadVideo');
      showToast(appError.userMessage, 'error');
    }
  };

  const loadMore = () => {
    const nextPage = currentPage + 1;
    const startIndex = nextPage * ITEMS_PER_PAGE;
    const newVideos = allVideos.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    setDisplayedVideos([...displayedVideos, ...newVideos]);
    setCurrentPage(nextPage);
  };

  const openLightbox = (videoUrl: string, videoId: string, isViewed: boolean) => {
    setLightboxVideo(videoUrl);
    setLightboxOpen(true);
    if (!isViewed) {
      markAsViewed(videoId);
    }
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxVideo('');
  };

  return (
    <AuthenticatedLayout>
      <div className="content-wrapper">
        <div className="page-header">
          <h1 className="page-title">VIDEO ASSETS</h1>
          <p className="page-subtitle">You can see all the videos you have prepared here.</p>
        </div>

        <div className="sort-bar">
          <span className="sort-label">Sort By</span>
          <select className="sort-select" value={sortBy} onChange={handleSortChange}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="size_desc">Largest File</option>
            <option value="size_asc">Smallest File</option>
          </select>
        </div>

        <div className="gallery-container">
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <div>Loading videos...</div>
            </div>
          )}

          {!loading && allVideos.length === 0 && (
            <div className="empty-state">
              <img src="/empty_video_icon.png" alt="No videos" className="empty-state-icon" />
              <div className="empty-state-text">No videos found. Start creating!</div>
            </div>
          )}

          {!loading && allVideos.length > 0 && (
            <>
              <div className="gallery-grid">
                {displayedVideos.map((video) => {
                  const videoUrl = getBunnyCDNUrl(video.file_path, 'video-assets');
                  
                  return (
                    <div key={video.id} className="gallery-item-wrapper">
                      <div 
                        className={`gallery-item ${!video.is_viewed ? 'new-video' : ''}`}
                        onClick={() => openLightbox(videoUrl, video.id, video.is_viewed)}
                      >
                        <div className="gallery-item-video-container">
                          <video src={videoUrl} preload="metadata"></video>
                          <div className="gallery-item-overlay">
                            <svg viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" fill="currentColor"/>
                            </svg>
                          </div>
                        </div>
                        {!video.is_viewed && (
                          <div className="new-video-badge">
                            <img src="/icon_new_video.png" alt="New Video" />
                          </div>
                        )}
                      </div>
                      
                      <div className="gallery-item-actions">
                        <button 
                          className={`action-btn favorite-btn ${video.is_favorite ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(video.id);
                          }}
                        >
                          <svg className="favorite-icon" viewBox="0 0 24 24" fill={video.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </button>
                        <button 
                          className="action-btn download-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadVideo(videoUrl, video.file_name);
                          }}
                        >
                          DOWNLOAD
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {displayedVideos.length < allVideos.length && (
                <div className="load-more-container">
                  <button className="load-more-btn" onClick={loadMore}>
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <div className="lightbox active" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <video src={lightboxVideo} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh' }}></video>
          </div>
        </div>
      )}

      <style jsx>{`
        .content-wrapper {
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 40px;
        }

        .page-header {
          text-align: center;
          margin-bottom: 15px;
        }

        .page-title {
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #ffffff;
          margin-bottom: 10px;
        }

        .page-subtitle {
          font-size: 15px;
          color: #999999;
          font-weight: 400;
        }

        .sort-bar {
          background: #2a2b2f;
          border-radius: 12px;
          padding: 0 30px;
          height: 60px;
          display: flex;
          align-items: center;
          margin-bottom: 40px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .sort-label {
          font-size: 14px;
          color: #999;
          margin-right: 15px;
          font-weight: 500;
        }

        .sort-select {
          background: #1a1a1a;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 10px 40px 10px 15px;
          font-size: 14px;
          color: #fff;
          cursor: pointer;
          outline: none;
          appearance: none;
          background-image: url('data:image/svg+xml;utf8,<svg fill="%23999" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 11L3 6h10z"/></svg>');
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 12px;
        }

        .sort-select:hover {
          border-color: #555;
        }

        .gallery-container {
          background: transparent;
          border: 2px solid #313237;
          border-radius: 20px;
          padding: 40px;
          min-height: 500px;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        .gallery-item-wrapper {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .gallery-item {
          aspect-ratio: 3/4;
          border-radius: 12px;
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

        .gallery-item.new-video {
          border: 5px solid #27a600;
          box-sizing: border-box;
        }

        .gallery-item-video-container {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          overflow: hidden;
        }

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

        .new-video-badge {
          position: absolute;
          top: 50%;
          right: 0;
          transform: translateY(-50%);
          width: 125px;
          height: 125px;
          pointer-events: none;
          z-index: 10;
        }

        .new-video-badge img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .gallery-item-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .action-btn {
          flex: 1;
          height: 42px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(180deg, #555760 0%, #3b3d44 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .action-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }

        .favorite-btn {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          padding: 0;
        }

        .favorite-btn.active {
          background: #ff8e00;
        }

        .favorite-icon {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          color: #666;
        }

        .empty-state-icon {
          width: 140px;
          height: 140px;
          margin: 0 auto 20px;
          display: block;
          opacity: 0.3;
        }

        .empty-state-text {
          font-size: 18px;
          color: #999;
        }

        .load-more-container {
          text-align: center;
          padding-top: 20px;
        }

        .load-more-btn {
          background: linear-gradient(180deg, #313236 0%, #1f1f22 100%);
          border: none;
          border-radius: 12px;
          padding: 18px 60px;
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
          text-transform: uppercase;
        }

        .load-more-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
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
          stroke: #000;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #999;
        }

        .spinner {
          border: 3px solid #333;
          border-top: 3px solid #fff;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 1200px) {
          .gallery-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        @media (max-width: 900px) {
          .gallery-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 768px) {
          .content-wrapper {
            padding: 40px 20px;
          }

          .page-title {
            font-size: 32px;
          }

          .gallery-container {
            padding: 25px;
          }

          .gallery-grid {
            gap: 15px;
          }

          .action-btn {
            font-size: 11px;
            height: 38px;
          }

          .favorite-btn {
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
          }
        }

        @media (max-width: 480px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .new-video-badge {
            width: 80px;
            height: 80px;
            top: 50%;
            transform: translateY(-50%);
          }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}