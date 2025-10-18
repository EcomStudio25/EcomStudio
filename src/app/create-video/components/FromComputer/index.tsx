'use client';

import { useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import VideoPlayer from '../shared/VideoPlayer';
import VideoProcessing from '../shared/VideoProcessing';

interface UploadedImage {
  url: string;
  filename: string;
}

interface ImageSettings {
  imageUrl: string;
  duration: string;
  prompt: string;
  negativePrompt: string;
  creativity: number;
}

interface FromComputerProps {
  supabase: SupabaseClient;
  userId: string | null;
  onGenerateStart: () => void;
  onGenerateEnd: () => void;
  onDeductCredits: (count: number) => Promise<boolean>;
  creditPerImage: number;
  pricing: { credit_per_image: number; discount_rate: number };
}

export default function FromComputer({
  supabase,
  userId,
  onGenerateStart,
  onGenerateEnd,
  onDeductCredits,
  creditPerImage,
  pricing,
}: FromComputerProps) {
  const { showToast } = useToast();

  const [uploadedImages, setUploadedImages] = useState<(UploadedImage | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [settings, setSettings] = useState<Record<number, ImageSettings>>({});
  const [productCode, setProductCode] = useState('');
  const [expandedSettings, setExpandedSettings] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [timer, setTimer] = useState('00:00');
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  const handleFileSelect = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file!', 'error');
      return;
    }

    setUploadingIndex(index);

    try {
      // ✅ SECURE: Upload through API route with authentication
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId || '');

      // Get auth token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const uploadResponse = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await uploadResponse.json();

      const newUploadedImages = [...uploadedImages];
      newUploadedImages[index] = {
        url: result.url,
        filename: result.filename,
      };
      setUploadedImages(newUploadedImages);

      if (!settings[index]) {
        setSettings({
          ...settings,
          [index]: {
            imageUrl: result.url,
            duration: '5',
            prompt: '',
            negativePrompt: '',
            creativity: 0.5,
          },
        });
      }

      showToast('Image uploaded successfully!', 'success');
    } catch (error) {
      const appError = handleError(error, 'handleFileSelect');
      showToast(appError.userMessage, 'error');
    } finally {
      setUploadingIndex(null);
    }
  };

  const removeImage = (index: number) => {
    const newUploadedImages = [...uploadedImages];
    newUploadedImages[index] = null;
    setUploadedImages(newUploadedImages);

    const newSettings = { ...settings };
    delete newSettings[index];
    setSettings(newSettings);
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
    const uploadCount = uploadedImages.filter((img) => img).length;

    if (uploadCount < 1) {
      showToast('Please upload at least 1 image!', 'error');
      return;
    }

    // Deduct credits first
    const credited = await onDeductCredits(uploadCount);
    if (!credited) {
      showToast(
        `Insufficient credits! You need ${uploadCount * creditPerImage} credits${pricing.discount_rate > 0 ? ` (${pricing.discount_rate}% discount applied)` : ''}. Please go to user settings to add credits.`,
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

    const validImages = uploadedImages.filter((img) => img) as UploadedImage[];
    const validSettings: Record<number, ImageSettings> = {};
    validImages.forEach((img, idx) => {
      validSettings[idx] = settings[idx] || {
        imageUrl: img.url,
        duration: '5',
        prompt: '',
        negativePrompt: '',
        creativity: 0.5,
      };
    });

    const payload = {
      userId: userId,
      refNo: refNo,
      selectedImages: validImages.map((img) => img.url),
      imageCount: validImages.length,
      settings: validSettings,
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
      <div className="recommendation-text">
        <strong>For better results,</strong> we recommend that you upload images
        that are similar in size and that you select and arrange images that are a
        continuation of each other.
      </div>

      <div className="upload-header">
        <div className="product-code-input">
          <label>Product Name / Code / Barcode:</label>
          <input
            type="text"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            placeholder="(Optional)"
          />
        </div>
        <div className="upload-count">
          Please select up to 4 images:{' '}
          <strong>{uploadedImages.filter((img) => img).length}/4</strong>
        </div>
      </div>

      <div className="upload-grid">
        {[0, 1, 2, 3].map((index) => {
          const uploadCount = uploadedImages.filter((img) => img).length;
          const isActive = index === uploadCount || uploadCount === 0;
          const isUploaded = uploadedImages[index] !== null;
          const isUploading = uploadingIndex === index;

          return (
            <div
              key={index}
              className={`upload-box ${isActive || isUploaded ? 'active' : ''} ${
                isUploaded ? 'uploaded' : ''
              }`}
            >
              <div className="upload-box-title">{index + 1}. IMAGE</div>
              <div className={`upload-area ${isUploaded ? 'uploaded' : ''} ${isUploading ? 'uploading' : ''}`}>
                {/* Spinner during upload */}
                {isUploading && (
                  <div className="upload-spinner">
                    <div className="spinner"></div>
                    <div className="uploading-text">Uploading...</div>
                  </div>
                )}

                {/* Upload placeholder (when not uploaded) */}
                {!isUploaded && !isUploading && (
                  <div
                    onClick={() => {
                      if (isActive) {
                        const input = document.getElementById(
                          `file-input-${index}`
                        ) as HTMLInputElement;
                        input?.click();
                      }
                    }}
                    style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: isActive ? 'pointer' : 'not-allowed' }}
                  >
                    <div className="upload-icon">+</div>
                    <div className="upload-text">
                      Click here to
                      <br />
                      upload an image.
                    </div>
                  </div>
                )}

                {/* Uploaded image with Remove button */}
                {isUploaded && !isUploading && (
                  <>
                    <img
                      className="upload-preview"
                      src={uploadedImages[index]?.url}
                      alt="Uploaded image"
                    />
                    <button
                      className="remove-image-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(index);
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </>
                )}

                <input
                  type="file"
                  id={`file-input-${index}`}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(index, file);
                  }}
                />
              </div>
              <div
                className={`upload-settings ${isUploaded ? '' : 'inactive'}`}
              >
                <div className="duration-row">
                  <select
                    className="duration-select"
                    value={settings[index]?.duration || '5'}
                    onChange={(e) => {
                      setSettings({
                        ...settings,
                        [index]: {
                          ...settings[index],
                          imageUrl: uploadedImages[index]?.url || '',
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
                              imageUrl: uploadedImages[index]?.url || '',
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
                              imageUrl: uploadedImages[index]?.url || '',
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
                              imageUrl: uploadedImages[index]?.url || '',
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
              </div>
            </div>
          );
        })}
      </div>

      <button
        className={`btn-generate ${
          uploadedImages.filter((img) => img).length >= 1 ? 'active' : ''
        }`}
        onClick={generateVideo}
        disabled={uploadedImages.filter((img) => img).length < 1}
      >
        GENERATE MY VIDEO ({uploadedImages.filter((img) => img).length * 100}{' '}
        CREDITS)
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

        .upload-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px 30px;
          background: #252525;
          border-radius: 12px;
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

        .upload-count {
          font-size: 14px;
          color: #999;
        }

        .upload-count strong {
          color: #fff;
        }

        .upload-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
          margin-bottom: 30px;
        }

        .upload-box {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 15px;
          padding: 20px;
          opacity: 0.2;
          transition: all 0.3s;
          pointer-events: none;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .upload-box.active {
          opacity: 1;
          pointer-events: auto;
        }

        .upload-box.uploaded {
          opacity: 1;
        }

        .upload-box-title {
          font-size: 16px;
          color: #00d4ff;
          font-weight: 600;
          margin-bottom: 15px;
          text-align: center;
        }

        .upload-area {
          width: 100%;
          height: 450px;
          background: #0066ff;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 15px;
          position: relative;
          overflow: hidden;
        }

        .upload-area:hover {
          background: #0052cc;
        }

        .upload-area.uploaded {
          background: transparent;
          cursor: default;
        }

        .upload-area.uploaded:hover {
          background: transparent;
        }

        .upload-icon {
          font-size: 48px;
          color: white;
          margin-bottom: 15px;
        }

        .upload-text {
          color: white;
          font-size: 16px;
          text-align: center;
          line-height: 1.4;
        }

        .upload-area.uploaded .upload-icon,
        .upload-area.uploaded .upload-text {
          display: none;
        }

        .upload-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: none;
        }

        .upload-area.uploaded .upload-preview {
          display: block;
        }

        .upload-area.uploading {
          background: #1a1a1a;
          cursor: wait;
        }

        .upload-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 15px;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #333;
          border-top: 4px solid #0066ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .uploading-text {
          color: #0066ff;
          font-size: 16px;
          font-weight: 600;
        }

        .remove-image-btn {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 8px 16px;
          background: rgba(0, 0, 0, 0.85);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          z-index: 10;
          letter-spacing: 0.5px;
        }

        .remove-image-btn:hover {
          background: rgba(0, 0, 0, 0.95);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        }

        .upload-settings {
          opacity: 0.3;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .upload-box.uploaded .upload-settings {
          opacity: 1;
          pointer-events: auto;
        }

        .upload-settings.inactive {
          opacity: 0.3;
          pointer-events: none;
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

        .btn-generate:disabled {
          background: #444;
          color: #888;
          cursor: not-allowed;
        }

        @media (max-width: 1200px) {
          .upload-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .upload-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
