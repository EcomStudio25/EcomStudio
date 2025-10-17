'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function LibraryPage() {
  const { showToast } = useToast();
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allFiles, setAllFiles] = useState<any[]>([]);
  const [displayedFiles, setDisplayedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState('newest');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxContent, setLightboxContent] = useState<{ url: string; type: string }>({ url: '', type: '' });

  const ITEMS_PER_PAGE = 18;

  useEffect(() => {
    checkAuth();
  }, []);

  const getBunnyCDNUrl = (filePath: string, folder = 'uploads') => {
    if (!currentUser) return filePath;
    const fileName = filePath.split('/').pop();
    return `https://ess25.b-cdn.net/user-${currentUser.id}/${folder}/${fileName}`;
  };

  const checkAuth = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setCurrentUser(user);
      await loadFiles('newest', user);
    } catch (error) {
      const appError = handleError(error, 'checkAuth');
      showToast(appError.userMessage, 'error');
      window.location.href = '/login';
    }
  };

  const loadFiles = async (sortOption: string, user: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_files')
        .select('*')
        .eq('user_id', user.id)
        .eq('folder', 'uploads');

      if (error) throw error;

      const files = data || [];
      const sortedFiles = sortFilesArray(files, sortOption);
      setAllFiles(sortedFiles);
      setDisplayedFiles(sortedFiles.slice(0, ITEMS_PER_PAGE));
      setCurrentPage(0);
    } catch (error) {
      const appError = handleError(error, 'loadFiles');
      showToast(appError.userMessage, 'error');
      setAllFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const sortFilesArray = (files: any[], sortOption: string) => {
    const sorted = [...files];
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
      loadFiles(newSort, currentUser);
    }
  };

  const loadMore = () => {
    const nextPage = currentPage + 1;
    const startIndex = nextPage * ITEMS_PER_PAGE;
    const newFiles = allFiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    setDisplayedFiles([...displayedFiles, ...newFiles]);
    setCurrentPage(nextPage);
  };

  const openLightbox = (fileUrl: string, fileType: string) => {
    setLightboxContent({ url: fileUrl, type: fileType });
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxContent({ url: '', type: '' });
  };

  return (
    <AuthenticatedLayout>
      <div className="content-wrapper">
        <div className="page-header">
          <h1 className="page-title">LIBRARY</h1>
          <p className="page-subtitle">All your uploaded files are stored here.</p>
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
              <div>Loading library...</div>
            </div>
          )}

          {!loading && allFiles.length === 0 && (
            <div className="empty-state">
              <img src="/empty_library_icon.png" alt="No files" className="empty-state-icon" />
              <div className="empty-state-text">No files found. Upload your first file!</div>
            </div>
          )}

          {!loading && allFiles.length > 0 && (
            <>
              <div className="gallery-grid">
                {displayedFiles.map((file) => {
                  const fileUrl = getBunnyCDNUrl(file.file_path, 'uploads');
                  
                  return (
                    <div 
                      key={file.id} 
                      className="gallery-item"
                      onClick={() => openLightbox(fileUrl, file.file_type)}
                    >
                      {file.file_type === 'video' ? (
                        <>
                          <video src={fileUrl} preload="metadata"></video>
                          <div className="gallery-item-overlay">
                            <svg viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" fill="currentColor"/>
                            </svg>
                          </div>
                        </>
                      ) : (
                        <img src={fileUrl} alt={file.file_name} />
                      )}
                    </div>
                  );
                })}
              </div>

              {displayedFiles.length < allFiles.length && (
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
            {lightboxContent.type === 'video' ? (
              <video src={lightboxContent.url} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '90vh' }}></video>
            ) : (
              <img src={lightboxContent.url} alt="Full size" style={{ maxWidth: '90vw', maxHeight: '90vh' }} />
            )}
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

        .gallery-item {
          aspect-ratio: 3/4;
          border-radius: 12px;
          overflow: hidden;
          position: relative;
          cursor: pointer;
          transition: all 0.3s;
          background: #1a1a1a;
        }

        .gallery-item:hover {
          transform: scale(1.05);
          box-shadow: 0 8px 25px rgba(255, 255, 255, 0.1);
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
        }

        @media (max-width: 480px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}