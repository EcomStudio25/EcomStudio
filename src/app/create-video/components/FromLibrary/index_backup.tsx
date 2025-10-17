'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import VideoPlayer from '../shared/VideoPlayer';
import VideoProcessing from '../shared/VideoProcessing';

interface ImageData {
  url: string;
  thumbnail: string;
  name?: string;
  date?: Date;
}

interface ImageSettings {
  imageUrl: string;
  duration: string;
  prompt: string;
  negativePrompt: string;
  creativity: number;
}

interface FromLibraryProps {
  userId: string | null;
  onGenerateStart: () => void;
  onGenerateEnd: () => void;
  onDeductCredits: (count: number) => Promise<boolean>;
}

export default function FromLibrary({
  userId,
  onGenerateStart,
  onGenerateEnd,
  onDeductCredits,
}: FromLibraryProps) {
  const { showToast } = useToast();

  const [libraryImages, setLibraryImages] = useState<ImageData[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<number, ImageSettings>>({});
  const [productCode, setProductCode] = useState('');
  const [displayCount, setDisplayCount] = useState(18);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [timer, setTimer] = useState('00:00');
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadLibrary();
  }, [userId]);

  const loadLibrary = async () => {
    if (!userId) return;

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BUNNY_STORAGE_URL}/user-${userId}/uploads/`,
        {
          method: 'GET',
          headers: { AccessKey: process.env.NEXT_PUBLIC_BUNNY_ACCESS_KEY! },
        }
      );

      if (!response.ok) throw new Error('Could not load library');

      const data = await response.json();

      const images = data
        .filter(
          (file: any) =>
            !file.IsDirectory &&
            file.ObjectName.match(/\.(jpg|jpeg|png|gif|webp)$/i)
        )
        .map((file: any) => ({
          url: `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/user-${userId}/uploads/${file.ObjectName}`,
          thumbnail: `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/user-${userId}/uploads/${file.ObjectName}`,
          name: file.ObjectName,
          date: new Date(file.LastChanged),
        }))
        .sort(
          (a: ImageData, b: ImageData) =>
            (b.date?.getTime() || 0) - (a.date?.getTime() || 0)
        );

      setLibraryImages(images);
    } catch (error) {
      const appError = handleError(error, 'loadLibrary');
      showToast(appError.userMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleImage = (imageUrl: string) => {
    const isSelected = selectedImages.includes(imageUrl);

    if (isSelected) {
      setSelectedImages(selectedImages.filter((url) => url !== imageUrl));
    } else {
      if (selectedImages.length >= 4) {
        showToast('Maximum 4 images can be selected!', 'error');
        return;
      }
      setSelectedImages([...selectedImages, imageUrl]);
    }
  };

  const confirmSelection = () => {
    if (selectedImages.length < 1) {
      showToast('Please select at least 1 image!', 'error');
      return;
    }

    const newSettings: Record<number, ImageSettings> = {};
    selectedImages.forEach((img, index) => {
      newSettings[index] = {
        imageUrl: img,
        duration: '5',
        prompt: '',
        negativePrompt: '',
        creativity: 0.5,
      };
    });
    setSettings(newSettings);
    setShowSettings(true);

    // Auto-scroll to settings
    setTimeout(() => {
      const settingsElement = document.getElementById('settings-section');
      settingsElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const editAgain = () => {
    setShowSettings(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startTimer = () => {
    let seconds = 0;

    const interval = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setTimer(
        String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
      );
    }, 1000);

    setTimerInterval(interval);
  };

  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const startStatusCheck = (statusUrl: string, refNo: string) => {
    let attempts = 0;
    const maxAttempts = 60;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const response = await fetch(process.env.NEXT_PUBLIC_STATUS_WEBHOOK!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status_url: statusUrl,
            refNo: refNo,
            userId: userId,
          }),
        });

        if (!response.ok) throw new Error('Status check failed');

        const status = await response.json();

        if (status.status === 'completed' && status.video_url) {
          clearInterval(interval);
          showVideo(status.video_url);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          onGenerateEnd();
          showToast('Video generation failed.', 'error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          onGenerateEnd();
          showToast('Process took too long.', 'error');
        }
      } catch (error) {
        if (attempts >= 3) {
          clearInterval(interval);
          onGenerateEnd();
          showToast('Cannot check video status.', 'error');
        }
      }
    }, 10000);

    setStatusCheckInterval(interval);
  };

  const showVideo = (url: string) => {
    stopTimer();
    setIsProcessing(false);
    setVideoUrl(url);
    onGenerateEnd();
    showToast('Video successfully created!', 'success');
  };

  const generateVideo = async () => {
    if (selectedImages.length < 1) {
      showToast('Please select at least 1 image!', 'error');
      return;
    }

    // Deduct credits first
    const credited = await onDeductCredits(selectedImages.length);
    if (!credited) {
      showToast(
        `Insufficient credits! You need ${selectedImages.length * 100} credits. Please go to user settings to add credits.`,
        'error'
      );
      return;
    }

    onGenerateStart();
    setIsProcessing(true);

    const code = productCode.trim();
    const refNo = code
      ? `${code}_${Math.floor(10000 + Math.random() * 90000)}`
      : `Ecom_Studio_video_${Math.floor(1000000000 + Math.random() * 9000000000)}`;

    setShowSettings(false);
    startTimer();

    const payload = {
      userId: userId,
      refNo: refNo,
      selectedImages: selectedImages,
      imageCount: selectedImages.length,
      settings: settings,
    };

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SAVE_WEBHOOK!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Could not start video generation');

      const result = await response.json();

      if (result.video_url) {
        showVideo(result.video_url);
      } else if (result.status_url) {
        startStatusCheck(result.status_url, refNo);
      } else {
        showToast('Video generation started!', 'success');
      }
    } catch (error) {
      const appError = handleError(error, 'generateVideo');
      showToast(appError.userMessage, 'error');
      setIsProcessing(false);
      stopTimer();
      onGenerateEnd();
    }
  };

  if (videoUrl) {
    return <VideoPlayer videoUrl={videoUrl} />;
  }

  if (isProcessing) {
    return <VideoProcessing timer={timer} />;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <img src="/fetching.gif" alt="Loading" />
        <div className="loading-text">LOADING LIBRARY...</div>

        <style jsx>{`
          .loading-container {
            text-align: center;
            padding: 60px 20px;
          }

          .loading-container img {
            width: 80px;
            height: auto;
            margin-bottom: 15px;
          }

          .loading-text {
            font-size: 18px;
            color: #ffffff;
            font-weight: 500;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="method-content">
      <div className="recommendation-text">
        <strong>For better results,</strong> we recommend that you upload
        images that are similar in size and that you select and arrange images
        that are a continuation of each other.
      </div>

      {/* Gallery Section - Always visible, but dimmed when settings are shown */}
      <div className={`gallery-wrapper ${showSettings ? 'dimmed' : ''}`}>
        <div className="gallery-container">
          <div className="gallery-header">
            <div className="product-code-input">
              <label>Product Name / Code / Barcode:</label>
              <input
                type="text"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="(Optional)"
              />
            </div>
            <div className="selection-count">
              Please select up to 4 images:{' '}
              <strong>{selectedImages.length}/4</strong>
            </div>
          </div>

          <div className="gallery">
            {libraryImages.slice(0, displayCount).map((img, index) => (
              <div
                key={index}
                className={`image-item ${
                  selectedImages.includes(img.url) ? 'selected' : ''
                }`}
                onClick={() => toggleImage(img.url)}
              >
                <img src={img.thumbnail} alt={img.name} />
                <div className="checkbox">✓</div>
                <div className="image-number">
                  {selectedImages.includes(img.url)
                    ? selectedImages.indexOf(img.url) + 1
                    : ''}
                </div>
              </div>
            ))}
          </div>

          {displayCount < libraryImages.length && (
            <button
              className="btn-load-more"
              onClick={() => setDisplayCount(displayCount + 18)}
            >
              LOAD MORE IMAGES
            </button>
          )}

          <button
            className={`btn-confirm ${selectedImages.length >= 1 ? 'active' : ''}`}
            onClick={confirmSelection}
            disabled={selectedImages.length < 1}
          >
            CONFIRM SELECTED IMAGES
          </button>
        </div>

        <style jsx>{`
          .recommendation-text {
            text-align: center;
            color: #999;
            font-size: 14px;
            line-height: 1.6;
            margin: 30px auto 40px;
            max-width: 800px;
          }

          .recommendation-text strong {
            color: #fff;
          }

          .gallery-container {
            background: #252525;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
          }

          .gallery-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 1px solid #333;
          }

          .product-code-input {
            display: flex;
            align-items: center;
            gap: 15px;
          }

          .product-code-input label {
            color: #999;
            font-size: 14px;
            white-space: nowrap;
          }

          .product-code-input input {
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 10px 15px;
            color: #fff;
            font-size: 14px;
            width: 250px;
          }

          .selection-count {
            font-size: 14px;
            color: #999;
          }

          .selection-count strong {
            color: #fff;
          }

          .gallery {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
            max-height: 980px;
            overflow-y: auto;
            padding-right: 10px;
          }

          .gallery::-webkit-scrollbar {
            width: 8px;
          }

          .gallery::-webkit-scrollbar-track {
            background: #1a1a1a;
            border-radius: 4px;
          }

          .gallery::-webkit-scrollbar-thumb {
            background: #444;
            border-radius: 4px;
          }

          .gallery::-webkit-scrollbar-thumb:hover {
            background: #555;
          }

          .image-item {
            position: relative;
            border: 3px solid transparent;
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s;
            background: #1a1a1a;
          }

          .image-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          }

          .image-item.selected {
            border-color: #00b00a;
            box-shadow: 0 0 0 3px rgba(0, 176, 10, 0.3);
          }

          .image-item img {
            width: 100%;
            height: 300px;
            object-fit: cover;
            display: block;
          }

          .image-item .checkbox {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            font-size: 18px;
            color: transparent;
          }

          .image-item.selected .checkbox {
            background: #00b00a;
            color: white;
          }

          .image-number {
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: bold;
            display: none;
            border: 2px solid #00b00a;
          }

          .image-item.selected .image-number {
            display: block;
          }

          .btn-load-more {
            width: 100%;
            padding: 18px 50px;
            background: linear-gradient(to bottom, #3c3d43 0%, #1f1f22 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s;
            letter-spacing: 1px;
            margin-bottom: 20px;
          }

          .btn-load-more:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(60, 61, 67, 0.5);
            background: linear-gradient(to bottom, #454651 0%, #2a2a2d 100%);
          }

          .btn-confirm {
            width: 100%;
            padding: 18px 50px;
            background: #444;
            color: #888;
            border: none;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 700;
            cursor: not-allowed;
            transition: all 0.3s;
            letter-spacing: 1px;
          }

          .btn-confirm.active {
            background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
            color: white;
            cursor: pointer;
          }

          .btn-confirm.active:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
          }

          .btn-confirm:disabled {
            background: #444;
            color: #888;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="method-content">
        <div className="recommendation-text">
          <strong>For better results,</strong> we recommend that you upload
          images that are similar in size and that you select and arrange images
          that are a continuation of each other.
        </div>

        <div className="settings-grid">
          {[0, 1, 2, 3].map((index) => {
            const isActive = index < selectedImages.length;
            const imgSrc = isActive ? selectedImages[index] : '';

            return (
              <div key={index} className={`setting-card ${!isActive ? 'inactive' : ''}`}>
                <div className="card-header">
                  <div className="card-title">{index + 1}. IMAGE</div>
                  {imgSrc && (
                    <img src={imgSrc} className="card-image" alt={`Image ${index + 1}`} />
                  )}

                  <div className="duration-row">
                    <select
                      className="duration-select"
                      disabled={!isActive}
                      onChange={(e) => {
                        setSettings({
                          ...settings,
                          [index]: {
                            ...settings[index],
                            duration: e.target.value,
                          },
                        });
                      }}
                    >
                      <option value="5">5 Sec.</option>
                      <option value="10">10 Sec.</option>
                    </select>
                    <span className="pro-badge">PRO Version</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          className={`btn-generate ${selectedImages.length >= 1 ? 'active' : ''}`}
          onClick={generateVideo}
          disabled={selectedImages.length < 1}
        >
          GENERATE MY VIDEO ({selectedImages.length * 100} CREDITS)
        </button>

        <style jsx>{`
          .recommendation-text {
            text-align: center;
            color: #999;
            font-size: 14px;
            line-height: 1.6;
            margin: 30px auto 40px;
            max-width: 800px;
          }

          .recommendation-text strong {
            color: #fff;
          }

          .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
          }

          .setting-card {
            background: linear-gradient(to bottom, #313236, #1f1f22);
            border-radius: 15px;
            padding: 25px;
            transition: opacity 0.3s;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
          }

          .setting-card.inactive {
            opacity: 0.2;
            pointer-events: none;
          }

          .card-header {
            text-align: center;
          }

          .card-title {
            font-size: 16px;
            color: #00d4ff;
            font-weight: 600;
            margin-bottom: 15px;
          }

          .card-image {
            width: 100%;
            height: 450px;
            object-fit: cover;
            border-radius: 10px;
            margin-bottom: 15px;
          }

          .duration-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
          }

          .duration-select {
            background: #333;
            color: #fff;
            border: 1px solid #444;
            padding: 8px 15px;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
          }

          .pro-badge {
            color: #888;
            font-size: 12px;
          }

          .btn-generate {
            width: 100%;
            padding: 22px 50px;
            background: #444;
            color: #888;
            border: none;
            border-radius: 12px;
            font-size: 20px;
            font-weight: 700;
            cursor: not-allowed;
            transition: all 0.3s;
            letter-spacing: 2px;
          }

          .btn-generate.active {
            background: linear-gradient(to bottom, #8bed00 0%, #6bbe00 100%);
            color: white;
            cursor: pointer;
          }

          .btn-generate.active:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(139, 237, 0, 0.4);
          }

          .btn-generate:disabled {
            background: #444;
            color: #888;
            cursor: not-allowed;
          }

          @media (max-width: 1200px) {
            .settings-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 768px) {
            .settings-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    );
  }

  return null;
}
