'use client';

import { useState, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import VideoPlayer from '../shared/VideoPlayer';
import VideoProcessing from '../shared/VideoProcessing';

interface ImageData {
  url: string;
  selected: boolean;
}

interface ImageSettings {
  imageUrl: string;
  duration: string;
  prompt: string;
  negativePrompt: string;
  creativity: number;
}

interface FromURLProps {
  supabase: any;
  userId: string | null;
  onGenerateStart: () => void;
  onGenerateEnd: () => void;
  onDeductCredits: (count: number) => Promise<boolean>;
}

export default function FromURL({
  supabase,
  userId,
  onGenerateStart,
  onGenerateEnd,
  onDeductCredits,
}: FromURLProps) {
  const { showToast } = useToast();
  const settingsRef = useRef<HTMLDivElement>(null);

  const [productUrl, setProductUrl] = useState('');
  const [fetchedImages, setFetchedImages] = useState<ImageData[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [settings, setSettings] = useState<Record<number, ImageSettings>>({});
  const [productCode, setProductCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [expandedSettings, setExpandedSettings] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [timer, setTimer] = useState('00:00');
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchImages = async () => {
    const url = productUrl.trim();

    if (!url) {
      showToast('Please enter a product URL!', 'error');
      return;
    }

    setIsFetching(true);
    try {
      // ✅ SECURE: Fetch through API route with authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/fetch-product-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ productUrl: url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not fetch images');
      }

      const data = await response.json();
      const images = data.images || [];

      if (images.length === 0) {
        showToast('No images found for this URL', 'error');
        setIsFetching(false);
        return;
      }

      const formattedImages: ImageData[] = images.map((imgData: any) => ({
        url: imgData.url || imgData,
        selected: false,
      }));

      setFetchedImages(formattedImages);
      showToast(`Found ${formattedImages.length} images`, 'success');
    } catch (error) {
      const appError = handleError(error, 'fetchImages');
      showToast(appError.userMessage, 'error');
    } finally {
      setIsFetching(false);
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
      settingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const editAgain = () => {
    setShowSettings(false);
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
        // ✅ SECURE: Check status through API route with authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          clearInterval(interval);
          showToast('Authentication expired', 'error');
          return;
        }

        const response = await fetch('/api/check-video-status', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
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

    startTimer();

    const payload = {
      userId: userId,
      refNo: refNo,
      selectedImages: selectedImages,
      imageCount: selectedImages.length,
      settings: settings,
    };

    try {
      // ✅ SECURE: Generate video through API route with authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Could not start video generation');
      }

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

  return (
    <div className="method-content">
      {fetchedImages.length === 0 ? (
        <div className="url-input-section">
          <div className="recommendation-text">
            <strong>For better results,</strong> we recommend that you upload
            images that are similar in size and that you select and arrange images
            that are a continuation of each other.
          </div>

          <div className="input-group">
            <input
              type="text"
              className="url-input"
              placeholder="https://example.com/product"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              disabled={isFetching}
            />
            <button
              className="btn-fetch"
              onClick={fetchImages}
              disabled={isFetching}
            >
              {isFetching ? 'FETCHING...' : 'FETCH IMAGES'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="recommendation-text">
            <strong>For better results,</strong> we recommend that you upload
            images that are similar in size and that you select and arrange images
            that are a continuation of each other.
          </div>

          {/* Edit Again Button - Outside wrapper to avoid opacity inheritance */}
          <div className="edit-btn-wrapper">
            {showSettings && (
              <button className="edit-again-btn" onClick={editAgain}>
                EDIT AGAIN...
              </button>
            )}
          </div>

          {/* Gallery Section - Always visible but dimmed when settings shown */}
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
                    disabled={showSettings}
                  />
                </div>
                <div className="selection-count">
                  Please select up to 4 images:{' '}
                  <strong>{selectedImages.length}/4</strong>
                </div>
              </div>

              <div className="gallery">
                {fetchedImages.map((img, index) => (
                  <div
                    key={index}
                    className={`image-item ${
                      selectedImages.includes(img.url) ? 'selected' : ''
                    } ${showSettings ? 'disabled' : ''}`}
                    onClick={() => !showSettings && toggleImage(img.url)}
                  >
                    <img src={img.url} alt={`Product ${index + 1}`} />
                    <div className="checkbox">✓</div>
                    <div className="image-number">
                      {selectedImages.includes(img.url)
                        ? selectedImages.indexOf(img.url) + 1
                        : ''}
                    </div>
                  </div>
                ))}
              </div>

              {!showSettings && (
                <button
                  className={`btn-confirm ${selectedImages.length >= 1 ? 'active' : ''}`}
                  onClick={confirmSelection}
                  disabled={selectedImages.length < 1}
                >
                  CONFIRM SELECTED IMAGES
                </button>
              )}
            </div>
          </div>

          {/* Settings Section - Shows below gallery */}
          {showSettings && (
            <div className="settings-section" ref={settingsRef}>
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
                            value={settings[index]?.duration || '5'}
                            onChange={(e) => {
                              setSettings({
                                ...settings,
                                [index]: {
                                  ...settings[index],
                                  imageUrl: imgSrc,
                                  duration: e.target.value,
                                  prompt: settings[index]?.prompt || '',
                                  negativePrompt: settings[index]?.negativePrompt || '',
                                  creativity: settings[index]?.creativity || 0.5,
                                },
                              });
                            }}
                          >
                            <option value="5">5 Sec.</option>
                            <option value="10">10 Sec.</option>
                          </select>
                          <span className="pro-badge">PRO Version</span>
                        </div>

                        {/* Additional Settings Button */}
                        {isActive && (
                          <>
                            <button
                              className="additional-settings-btn"
                              onClick={() => {
                                setExpandedSettings({
                                  ...expandedSettings,
                                  [index]: !expandedSettings[index],
                                });
                              }}
                              type="button"
                            >
                              {expandedSettings[index] ? '▼' : '▶'} Additional Settings
                            </button>

                            {/* Expandable Additional Settings */}
                            {expandedSettings[index] && (
                              <div className="additional-settings-panel">
                                <div className="setting-group">
                                  <label>Prompt:</label>
                                  <textarea
                                    className="setting-textarea"
                                    value={settings[index]?.prompt || ''}
                                    onChange={(e) => {
                                      setSettings({
                                        ...settings,
                                        [index]: {
                                          ...settings[index],
                                          imageUrl: imgSrc,
                                          duration: settings[index]?.duration || '5',
                                          prompt: e.target.value,
                                          negativePrompt: settings[index]?.negativePrompt || '',
                                          creativity: settings[index]?.creativity || 0.5,
                                        },
                                      });
                                    }}
                                    placeholder="Describe what you want in the video..."
                                    rows={3}
                                  />
                                </div>

                                <div className="setting-group">
                                  <label>Negative Prompt:</label>
                                  <textarea
                                    className="setting-textarea"
                                    value={settings[index]?.negativePrompt || ''}
                                    onChange={(e) => {
                                      setSettings({
                                        ...settings,
                                        [index]: {
                                          ...settings[index],
                                          imageUrl: imgSrc,
                                          duration: settings[index]?.duration || '5',
                                          prompt: settings[index]?.prompt || '',
                                          negativePrompt: e.target.value,
                                          creativity: settings[index]?.creativity || 0.5,
                                        },
                                      });
                                    }}
                                    placeholder="Describe what you don't want..."
                                    rows={3}
                                  />
                                </div>

                                <div className="setting-group">
                                  <label>
                                    Creativity: {settings[index]?.creativity || 0.5}
                                  </label>
                                  <input
                                    type="range"
                                    className="creativity-slider"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={settings[index]?.creativity || 0.5}
                                    onChange={(e) => {
                                      setSettings({
                                        ...settings,
                                        [index]: {
                                          ...settings[index],
                                          imageUrl: imgSrc,
                                          duration: settings[index]?.duration || '5',
                                          prompt: settings[index]?.prompt || '',
                                          negativePrompt: settings[index]?.negativePrompt || '',
                                          creativity: parseFloat(e.target.value),
                                        },
                                      });
                                    }}
                                  />
                                  <div className="slider-labels">
                                    <span>Conservative (0)</span>
                                    <span>Creative (1)</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
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
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .method-content {
          padding: 20px;
        }

        .url-input-section {
          max-width: 800px;
          margin: 0 auto;
          text-align: center;
        }

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

        .input-group {
          display: flex;
          gap: 15px;
          align-items: stretch;
        }

        .url-input {
          flex: 1;
          padding: 18px 20px;
          background: #2a2b30;
          border: 1px solid #3c3d43;
          border-radius: 12px;
          color: #fff;
          font-size: 16px;
        }

        .url-input:focus {
          outline: none;
          border-color: #0066ec;
        }

        .url-input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-fetch {
          padding: 18px 40px;
          background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .btn-fetch:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
        }

        .btn-fetch:disabled {
          background: #444;
          cursor: not-allowed;
        }

        .edit-btn-wrapper {
          position: relative;
          height: 0;
          z-index: 100;
        }

        .edit-again-btn {
          position: absolute;
          top: 300px;
          left: 50%;
          transform: translateX(-50%);
          padding: 20px 50px;
          background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          letter-spacing: 1px;
          box-shadow: 0 10px 40px rgba(0, 102, 236, 0.6);
        }

        .edit-again-btn:hover {
          transform: translateX(-50%) translateY(-2px);
          box-shadow: 0 12px 50px rgba(0, 102, 236, 0.8);
        }

        .gallery-wrapper {
          position: relative;
          transition: all 0.3s;
        }

        .gallery-wrapper.dimmed {
          opacity: 0.2;
          pointer-events: none;
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

        .product-code-input input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .image-item.disabled {
          cursor: not-allowed;
        }

        .image-item:not(.disabled):hover {
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

        .settings-section {
          margin-top: 30px;
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

        .additional-settings-btn {
          width: 100%;
          background: transparent;
          border: 1px dashed #444;
          color: #999;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
          text-align: left;
        }

        .additional-settings-btn:hover {
          border-color: #666;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }

        .additional-settings-panel {
          margin-top: 15px;
          padding: 15px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          border: 1px solid #333;
        }

        .setting-group {
          margin-bottom: 15px;
        }

        .setting-group:last-child {
          margin-bottom: 0;
        }

        .setting-group label {
          display: block;
          color: #999;
          font-size: 13px;
          margin-bottom: 8px;
          font-weight: 500;
        }

        .setting-textarea {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 8px;
          padding: 10px;
          color: #fff;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
          transition: border-color 0.3s;
        }

        .setting-textarea:focus {
          outline: none;
          border-color: #0066ff;
        }

        .setting-textarea::placeholder {
          color: #666;
        }

        .creativity-slider {
          width: 100%;
          height: 6px;
          background: #333;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
        }

        .creativity-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #0066ff;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.3s;
        }

        .creativity-slider::-webkit-slider-thumb:hover {
          background: #0052cc;
          transform: scale(1.2);
        }

        .creativity-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #0066ff;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: all 0.3s;
        }

        .creativity-slider::-moz-range-thumb:hover {
          background: #0052cc;
          transform: scale(1.2);
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
        }

        .slider-labels span {
          font-size: 11px;
          color: #666;
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
