'use client';

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';

interface ImageData {
  url: string;
  thumbnail?: string;
}

interface ImageSettings {
  imageUrl: string;
  duration: string;
  prompt: string;
  negativePrompt: string;
  creativity: number;
}

interface BatchData {
  url: string;
  images: ImageData[];
  selectedImages: string[];
  productCode: string;
  settings: Record<number, ImageSettings>;
  isCompleted: boolean;
  isFetching: boolean;
}

interface BatchProcessingProps {
  supabase: any;
  userId: string | null;
  onGenerateStart: () => void;
  onGenerateEnd: () => void;
  onDeductCredits: (count: number) => Promise<boolean>;
}

export default function BatchProcessing({
  supabase,
  userId,
  onGenerateStart,
  onGenerateEnd,
  onDeductCredits,
}: BatchProcessingProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filename, setFilename] = useState('No file chosen');
  const [urls, setUrls] = useState<string[]>([]);
  const [batchData, setBatchData] = useState<BatchData[]>([]);
  const [expandedSettings, setExpandedSettings] = useState<Record<string, Record<number, boolean>>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFilename(file.name);
    } else {
      setFilename('No file chosen');
    }
  };

  const importExcel = async () => {
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      showToast('Please select an Excel file!', 'error');
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

      const extractedUrls: string[] = [];
      for (let i = 0; i < rows.length && i < 50; i++) {
        const url = rows[i]?.[0];
        if (url && typeof url === 'string' && url.trim() !== '') {
          if (url.includes('http') || url.includes('www')) {
            extractedUrls.push(url.trim());
          }
        }
      }

      if (extractedUrls.length === 0) {
        showToast('No valid URLs found in column A!', 'error');
        return;
      }

      setUrls(extractedUrls);

      // Initialize batch data
      const initialBatchData: BatchData[] = extractedUrls.map((url) => ({
        url,
        images: [],
        selectedImages: [],
        productCode: '',
        settings: {},
        isCompleted: false,
        isFetching: false,
      }));
      setBatchData(initialBatchData);

      showToast(`${extractedUrls.length} URL(s) imported successfully!`, 'success');

      // Start fetching images for first URL
      fetchImagesForUrl(0, initialBatchData);
    } catch (error) {
      const appError = handleError(error, 'importExcel');
      showToast(appError.userMessage, 'error');
    }
  };

  const fetchImagesForUrl = async (index: number, currentBatchData: BatchData[]) => {
    if (index >= currentBatchData.length) return;

    const url = currentBatchData[index].url;

    // Mark as fetching
    const updatedData = [...currentBatchData];
    updatedData[index] = { ...updatedData[index], isFetching: true };
    setBatchData(updatedData);

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

      const formattedImages: ImageData[] = images.map((imgData: any) => ({
        url: imgData.url || imgData,
        thumbnail: imgData.thumbnail || imgData.url || imgData,
      }));

      // Update batch data with fetched images
      const newBatchData = [...updatedData];
      newBatchData[index] = {
        ...newBatchData[index],
        images: formattedImages,
        isFetching: false,
      };
      setBatchData(newBatchData);

      showToast(`Fetched ${formattedImages.length} images for URL ${index + 1}`, 'success');
    } catch (error) {
      const appError = handleError(error, 'fetchImagesForUrl');
      showToast(`Failed to fetch URL ${index + 1}: ${appError.userMessage}`, 'error');

      // Mark as failed
      const newBatchData = [...updatedData];
      newBatchData[index] = { ...newBatchData[index], isFetching: false };
      setBatchData(newBatchData);
    }
  };

  const toggleImageSelection = (batchIndex: number, imageUrl: string) => {
    const currentData = batchData[batchIndex];
    const isSelected = currentData.selectedImages.includes(imageUrl);

    if (isSelected) {
      // Deselect
      const newBatchData = [...batchData];
      newBatchData[batchIndex] = {
        ...currentData,
        selectedImages: currentData.selectedImages.filter((url) => url !== imageUrl),
      };
      setBatchData(newBatchData);
    } else {
      // Select
      if (currentData.selectedImages.length >= 4) {
        showToast('Maximum 4 images can be selected!', 'error');
        return;
      }

      const newBatchData = [...batchData];
      newBatchData[batchIndex] = {
        ...currentData,
        selectedImages: [...currentData.selectedImages, imageUrl],
      };
      setBatchData(newBatchData);
    }
  };

  const confirmSelection = (batchIndex: number) => {
    const currentData = batchData[batchIndex];

    if (currentData.selectedImages.length < 1) {
      showToast('Please select at least 1 image!', 'error');
      return;
    }

    // Initialize settings
    const newSettings: Record<number, ImageSettings> = {};
    currentData.selectedImages.forEach((img, idx) => {
      newSettings[idx] = {
        imageUrl: img,
        duration: '5',
        prompt: '',
        negativePrompt: '',
        creativity: 0.5,
      };
    });

    const newBatchData = [...batchData];
    newBatchData[batchIndex] = {
      ...currentData,
      settings: newSettings,
      isCompleted: true,
    };
    setBatchData(newBatchData);

    // Fetch next URL if available
    if (batchIndex + 1 < batchData.length) {
      fetchImagesForUrl(batchIndex + 1, newBatchData);
    }

    // Auto-scroll to next item
    setTimeout(() => {
      const nextElement = document.getElementById(`batch-item-${batchIndex + 1}`);
      if (nextElement) {
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const editAgain = (batchIndex: number) => {
    const newBatchData = [...batchData];
    newBatchData[batchIndex] = {
      ...newBatchData[batchIndex],
      isCompleted: false,
    };
    setBatchData(newBatchData);
  };

  const updateSetting = (batchIndex: number, settingIndex: number, field: keyof ImageSettings, value: string | number) => {
    const newBatchData = [...batchData];
    const currentSettings = newBatchData[batchIndex].settings;

    newBatchData[batchIndex] = {
      ...newBatchData[batchIndex],
      settings: {
        ...currentSettings,
        [settingIndex]: {
          ...currentSettings[settingIndex],
          [field]: value,
        },
      },
    };

    setBatchData(newBatchData);
  };

  const updateProductCode = (batchIndex: number, code: string) => {
    const newBatchData = [...batchData];
    newBatchData[batchIndex] = {
      ...newBatchData[batchIndex],
      productCode: code,
    };
    setBatchData(newBatchData);
  };

  const toggleAdditionalSettings = (batchIndex: number, settingIndex: number) => {
    const key = `${batchIndex}`;
    setExpandedSettings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [settingIndex]: !prev[key]?.[settingIndex],
      },
    }));
  };

  const generateBatchVideos = async () => {
    const completedCount = batchData.filter((data) => data.isCompleted && data.selectedImages.length > 0).length;

    if (completedCount !== urls.length || completedCount === 0) {
      showToast('Please complete all URL selections first!', 'error');
      return;
    }

    const totalImages = batchData.reduce((sum, data) => sum + data.selectedImages.length, 0);

    const credited = await onDeductCredits(totalImages);
    if (!credited) {
      showToast(
        `Insufficient credits! You need ${totalImages * 100} credits. Please go to user settings to add credits.`,
        'error'
      );
      return;
    }

    onGenerateStart();
    setIsProcessing(true);

    const payloads = batchData.map((data) => {
      if (!data.isCompleted || data.selectedImages.length === 0) return null;

      const refNo = data.productCode
        ? `${data.productCode}_${Math.floor(10000 + Math.random() * 90000)}`
        : `Ecom_Studio_video_${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      return {
        userId: userId,
        refNo: refNo,
        selectedImages: data.selectedImages,
        imageCount: data.selectedImages.length,
        settings: data.settings,
      };
    }).filter((p) => p !== null);

    try {
      // ✅ SECURE: Generate through API route with authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      for (const payload of payloads) {
        const response = await fetch('/api/generate-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error('Failed to send payload:', payload);
        }
      }

      showToast(`${payloads.length} videos are being processed! You can leave this page.`, 'success');

      setTimeout(() => {
        setIsProcessing(false);
        onGenerateEnd();
      }, 3000);
    } catch (error) {
      const appError = handleError(error, 'generateBatchVideos');
      showToast(appError.userMessage, 'error');
      setIsProcessing(false);
      onGenerateEnd();
    }
  };

  const completedCount = batchData.filter((d) => d.isCompleted && d.selectedImages.length > 0).length;

  if (isProcessing) {
    return (
      <div className="batch-process-screen">
        <img src="/Video_Process.gif" alt="Processing" style={{ width: '500px', height: '400px', margin: '0 auto 30px' }} />
        <div className="process-title">THE PROCESS HAS BEGUN.</div>
        <div className="process-subtitle">
          Your videos will be uploaded to the Video Assets page as they are ready.
        </div>
        <div className="process-warning">
          You can leave the page if you want. It doesn't stop the process.
        </div>

        <style jsx>{`
          .batch-process-screen {
            text-align: center;
            padding: 80px 20px;
          }

          .process-title {
            font-size: 24px;
            color: #95ff04;
            font-weight: 600;
            margin-bottom: 15px;
          }

          .process-subtitle {
            font-size: 18px;
            color: #fff;
            margin-bottom: 10px;
          }

          .process-warning {
            font-size: 16px;
            color: #00c6ff;
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="batch-container">
      <div className="recommendation-text">
        <strong>For better results,</strong> we recommend that you upload
        images that are similar in size and that you select and arrange images
        that are a continuation of each other.
      </div>

      <div className="batch-upload-section">
        <div className="batch-file-input">
          <label htmlFor="batchExcelFile" className="batch-choose-btn">
            Choose File
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="batchExcelFile"
            accept=".xls,.xlsx"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
          <span className="batch-filename">{filename}</span>
          <button
            className="batch-import-btn"
            onClick={importExcel}
            disabled={filename === 'No file chosen'}
          >
            IMPORT
          </button>
        </div>
        <div className="batch-limit-text">
          Max. URL Limit is 50. It will only retrieve URLs from the first 50 rows in Excel.
        </div>
      </div>

      {batchData.length > 0 && (
        <>
          <div className="batch-url-list">
            {batchData.map((data, batchIndex) => (
              <div key={batchIndex} id={`batch-item-${batchIndex}`} className="batch-url-item">
                <div className="batch-url-header">
                  <span className="batch-url-number">{batchIndex + 1}.</span>
                  <span className="batch-url-text">{data.url}</span>
                  {data.isCompleted && (
                    <span className="batch-status-badge">✓ Completed</span>
                  )}
                </div>

                {data.isFetching && (
                  <div className="batch-loading">
                    <div className="spinner"></div>
                    <div>Fetching images...</div>
                  </div>
                )}

                {!data.isFetching && data.images.length > 0 && !data.isCompleted && (
                  <div className="batch-gallery-section">
                    <div className="batch-product-code">
                      <label>Product Name / Code / Barcode:</label>
                      <input
                        type="text"
                        value={data.productCode}
                        onChange={(e) => updateProductCode(batchIndex, e.target.value)}
                        placeholder="(Optional)"
                      />
                    </div>

                    <div className="batch-selection-count">
                      Please select up to 4 images: <strong>{data.selectedImages.length}/4</strong>
                    </div>

                    <div className="batch-gallery">
                      {data.images.map((img, imgIndex) => (
                        <div
                          key={imgIndex}
                          className={`batch-image-item ${
                            data.selectedImages.includes(img.url) ? 'selected' : ''
                          }`}
                          onClick={() => toggleImageSelection(batchIndex, img.url)}
                        >
                          <img src={img.thumbnail || img.url} alt={`Image ${imgIndex + 1}`} />
                          <div className="checkbox">✓</div>
                          <div className="image-number">
                            {data.selectedImages.includes(img.url)
                              ? data.selectedImages.indexOf(img.url) + 1
                              : ''}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      className={`batch-confirm-btn ${data.selectedImages.length >= 1 ? 'active' : ''}`}
                      onClick={() => confirmSelection(batchIndex)}
                      disabled={data.selectedImages.length < 1}
                    >
                      CONFIRM SELECTED IMAGES
                    </button>
                  </div>
                )}

                {data.isCompleted && (
                  <div className="batch-settings-section">
                    <button className="batch-edit-again-btn" onClick={() => editAgain(batchIndex)}>
                      ← EDIT AGAIN
                    </button>

                    <div className="batch-settings-grid">
                      {[0, 1, 2, 3].map((settingIndex) => {
                        const isActive = settingIndex < data.selectedImages.length;
                        const imgSrc = isActive ? data.selectedImages[settingIndex] : '';

                        return (
                          <div key={settingIndex} className={`batch-setting-card ${!isActive ? 'inactive' : ''}`}>
                            <div className="card-header">
                              <div className="card-title">{settingIndex + 1}. IMAGE</div>
                              {imgSrc && (
                                <img src={imgSrc} className="card-image" alt={`Image ${settingIndex + 1}`} />
                              )}

                              <div className="duration-row">
                                <select
                                  className="duration-select"
                                  disabled={!isActive}
                                  value={data.settings[settingIndex]?.duration || '5'}
                                  onChange={(e) => updateSetting(batchIndex, settingIndex, 'duration', e.target.value)}
                                >
                                  <option value="5">5 Sec.</option>
                                  <option value="10">10 Sec.</option>
                                </select>
                                <span className="pro-badge">PRO Version</span>
                              </div>

                              {isActive && (
                                <>
                                  <button
                                    className="additional-settings-btn"
                                    onClick={() => toggleAdditionalSettings(batchIndex, settingIndex)}
                                    type="button"
                                  >
                                    {expandedSettings[`${batchIndex}`]?.[settingIndex] ? '▼' : '▶'} Additional Settings
                                  </button>

                                  {expandedSettings[`${batchIndex}`]?.[settingIndex] && (
                                    <div className="additional-settings-panel">
                                      <div className="setting-group">
                                        <label>Prompt:</label>
                                        <textarea
                                          className="setting-textarea"
                                          value={data.settings[settingIndex]?.prompt || ''}
                                          onChange={(e) => updateSetting(batchIndex, settingIndex, 'prompt', e.target.value)}
                                          placeholder="Describe what you want in the video..."
                                          rows={3}
                                        />
                                      </div>

                                      <div className="setting-group">
                                        <label>Negative Prompt:</label>
                                        <textarea
                                          className="setting-textarea"
                                          value={data.settings[settingIndex]?.negativePrompt || ''}
                                          onChange={(e) => updateSetting(batchIndex, settingIndex, 'negativePrompt', e.target.value)}
                                          placeholder="Describe what you don't want..."
                                          rows={3}
                                        />
                                      </div>

                                      <div className="setting-group">
                                        <label>
                                          Creativity: {data.settings[settingIndex]?.creativity || 0.5}
                                        </label>
                                        <input
                                          type="range"
                                          className="creativity-slider"
                                          min="0"
                                          max="1"
                                          step="0.1"
                                          value={data.settings[settingIndex]?.creativity || 0.5}
                                          onChange={(e) => updateSetting(batchIndex, settingIndex, 'creativity', parseFloat(e.target.value))}
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
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            className={`batch-final-button ${completedCount === urls.length && urls.length > 0 ? 'active' : ''}`}
            onClick={generateBatchVideos}
            disabled={completedCount !== urls.length}
          >
            GENERATE ({completedCount}) VIDEOS ({batchData.reduce((sum, data) => sum + data.selectedImages.length, 0) * 100} CREDITS)
          </button>
        </>
      )}

      <style jsx>{`
        .batch-container {
          padding: 20px;
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

        .batch-upload-section {
          text-align: center;
          padding: 40px;
          background: #252525;
          border-radius: 15px;
          margin-bottom: 40px;
        }

        .batch-file-input {
          display: inline-flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }

        .batch-choose-btn {
          padding: 12px 30px;
          background: #333;
          color: #fff;
          border: 1px solid #444;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
        }

        .batch-filename {
          color: #999;
          font-size: 14px;
        }

        .batch-import-btn {
          padding: 15px 50px;
          background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .batch-import-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
        }

        .batch-import-btn:disabled {
          background: #444;
          color: #888;
          cursor: not-allowed;
        }

        .batch-limit-text {
          color: #999;
          font-size: 13px;
          margin-top: 10px;
        }

        .batch-url-list {
          margin-top: 30px;
        }

        .batch-url-item {
          background: #252525;
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 30px;
          border: 2px solid #333;
        }

        .batch-url-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .batch-url-number {
          font-size: 20px;
          color: #00d4ff;
          font-weight: 700;
        }

        .batch-url-text {
          flex: 1;
          color: #fff;
          font-size: 14px;
          word-break: break-all;
        }

        .batch-status-badge {
          background: #00b00a;
          color: #fff;
          padding: 6px 15px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }

        .batch-loading {
          text-align: center;
          padding: 40px;
        }

        .spinner {
          width: 50px;
          height: 50px;
          margin: 0 auto 20px;
          border: 4px solid #333;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .batch-loading div:not(.spinner) {
          color: #fff;
          font-size: 16px;
        }

        .batch-gallery-section {
          margin-top: 20px;
        }

        .batch-product-code {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .batch-product-code label {
          color: #999;
          font-size: 14px;
          white-space: nowrap;
        }

        .batch-product-code input {
          flex: 1;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 8px;
          padding: 10px 15px;
          color: #fff;
          font-size: 14px;
          max-width: 300px;
        }

        .batch-selection-count {
          font-size: 14px;
          color: #999;
          margin-bottom: 20px;
        }

        .batch-selection-count strong {
          color: #fff;
        }

        .batch-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        }

        .batch-image-item {
          position: relative;
          border: 3px solid transparent;
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
          background: #1a1a1a;
        }

        .batch-image-item:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .batch-image-item.selected {
          border-color: #00b00a;
          box-shadow: 0 0 0 3px rgba(0, 176, 10, 0.3);
        }

        .batch-image-item img {
          width: 100%;
          height: 200px;
          object-fit: cover;
          display: block;
        }

        .batch-image-item .checkbox {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 28px;
          height: 28px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          font-size: 16px;
          color: transparent;
        }

        .batch-image-item.selected .checkbox {
          background: #00b00a;
          color: white;
        }

        .image-number {
          position: absolute;
          bottom: 10px;
          left: 10px;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: bold;
          display: none;
          border: 2px solid #00b00a;
        }

        .batch-image-item.selected .image-number {
          display: block;
        }

        .batch-confirm-btn {
          width: 100%;
          padding: 15px 40px;
          background: #444;
          color: #888;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: not-allowed;
          transition: all 0.3s;
        }

        .batch-confirm-btn.active {
          background: linear-gradient(to bottom, #0066ec 0%, #0052be 100%);
          color: white;
          cursor: pointer;
        }

        .batch-confirm-btn.active:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
        }

        .batch-settings-section {
          margin-top: 20px;
        }

        .batch-edit-again-btn {
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
          margin-bottom: 20px;
        }

        .batch-edit-again-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 50px rgba(0, 102, 236, 0.8);
        }

        .batch-settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 20px;
        }

        .batch-setting-card {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border-radius: 15px;
          padding: 20px;
          transition: opacity 0.3s;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .batch-setting-card.inactive {
          opacity: 0.2;
          pointer-events: none;
        }

        .card-header {
          text-align: center;
        }

        .card-title {
          font-size: 15px;
          color: #00d4ff;
          font-weight: 600;
          margin-bottom: 12px;
        }

        .card-image {
          width: 100%;
          height: 300px;
          object-fit: cover;
          border-radius: 10px;
          margin-bottom: 12px;
        }

        .duration-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .duration-select {
          background: #333;
          color: #fff;
          border: 1px solid #444;
          padding: 7px 12px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
        }

        .pro-badge {
          color: #888;
          font-size: 11px;
        }

        .additional-settings-btn {
          width: 100%;
          background: transparent;
          border: 1px dashed #444;
          color: #999;
          padding: 8px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 8px;
          text-align: left;
        }

        .additional-settings-btn:hover {
          border-color: #666;
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }

        .additional-settings-panel {
          margin-top: 12px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          border: 1px solid #333;
        }

        .setting-group {
          margin-bottom: 12px;
        }

        .setting-group:last-child {
          margin-bottom: 0;
        }

        .setting-group label {
          display: block;
          color: #999;
          font-size: 12px;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .setting-textarea {
          width: 100%;
          background: #1a1a1a;
          border: 1px solid #444;
          border-radius: 8px;
          padding: 8px;
          color: #fff;
          font-size: 12px;
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
          height: 5px;
          background: #333;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
          appearance: none;
        }

        .creativity-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
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
          width: 16px;
          height: 16px;
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
          margin-top: 6px;
        }

        .slider-labels span {
          font-size: 10px;
          color: #666;
        }

        .batch-final-button {
          width: 100%;
          padding: 25px 50px;
          background: #444;
          color: #888;
          border: none;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 700;
          cursor: not-allowed;
          transition: all 0.3s;
          letter-spacing: 2px;
          margin-top: 30px;
        }

        .batch-final-button.active {
          background: linear-gradient(to bottom, #8bed00 0%, #6bbe00 100%);
          color: white;
          cursor: pointer;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }

        .batch-final-button.active:hover {
          background: linear-gradient(to bottom, #6bbe00 0%, #8bed00 100%);
        }

        @media (max-width: 1200px) {
          .batch-settings-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .batch-settings-grid {
            grid-template-columns: 1fr;
          }

          .batch-gallery {
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
