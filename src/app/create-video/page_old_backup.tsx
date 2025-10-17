'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useToast } from '@/components/Toast';
import { handleError } from '@/lib/errorHandler';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// Interfaces
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

interface UploadedImage {
  url: string;
  filename: string;
}

interface BatchData {
  url: string;
  images: ImageData[];
  selectedImages: string[];
  productCode: string;
  settings: Record<number, ImageSettings>;
}

export default function CreateVideoPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [supabase] = useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  // User & Credits
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Method Selection
  const [currentMethod, setCurrentMethod] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // FROM URL States
  const [productUrl, setProductUrl] = useState('');
  const [allImages, setAllImages] = useState<ImageData[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [imageSettings, setImageSettings] = useState<Record<number, ImageSettings>>({});
  const [urlProductCode, setUrlProductCode] = useState('');
  const [currentRefNo, setCurrentRefNo] = useState('');
  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage2Active, setStage2Active] = useState(false);
  const [stage3Active, setStage3Active] = useState(false);
  const [stage4Active, setStage4Active] = useState(false);
  const [videoPlayerActive, setVideoPlayerActive] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [processingTimer, setProcessingTimer] = useState('00:00');

  // FROM COMPUTER States
  const [uploadedImages, setUploadedImages] = useState<(UploadedImage | null)[]>([null, null, null, null]);
  const [computerSettings, setComputerSettings] = useState<Record<number, ImageSettings>>({});
  const [computerProductCode, setComputerProductCode] = useState('');
  const [computerStage4Active, setComputerStage4Active] = useState(false);
  const [computerVideoPlayerActive, setComputerVideoPlayerActive] = useState(false);
  const [computerVideoUrl, setComputerVideoUrl] = useState('');
  const [computerProcessingTimer, setComputerProcessingTimer] = useState('00:00');

  // FROM LIBRARY States
  const [libraryImages, setLibraryImages] = useState<ImageData[]>([]);
  const [librarySelectedImages, setLibrarySelectedImages] = useState<string[]>([]);
  const [librarySettings, setLibrarySettings] = useState<Record<number, ImageSettings>>({});
  const [libraryProductCode, setLibraryProductCode] = useState('');
  const [libraryDisplayCount, setLibraryDisplayCount] = useState(18);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryGalleryActive, setLibraryGalleryActive] = useState(false);
  const [librarySettingsActive, setLibrarySettingsActive] = useState(false);
  const [libraryStage4Active, setLibraryStage4Active] = useState(false);
  const [libraryVideoPlayerActive, setLibraryVideoPlayerActive] = useState(false);
  const [libraryVideoUrl, setLibraryVideoUrl] = useState('');
  const [libraryProcessingTimer, setLibraryProcessingTimer] = useState('00:00');

  // BATCH States
  const [batchUrls, setBatchUrls] = useState<string[]>([]);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(0);
  const [batchAllData, setBatchAllData] = useState<BatchData[]>([]);
  const [batchFilename, setBatchFilename] = useState('No file chosen');
  const [batchProcessScreenActive, setBatchProcessScreenActive] = useState(false);

  // Timers
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  // ============================================
  // INITIALIZE USER & LOAD CREDITS
  // ============================================
  useEffect(() => {
    loadUserProfile();

    return () => {
      if (statusCheckInterval) clearInterval(statusCheckInterval);
      if (timerInterval) clearInterval(timerInterval);
    };
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      if (!user) {
        router.push('/login');
        return;
      }

      setCurrentUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      setUserCredits(profile?.credits || 0);
      setLoading(false);
    } catch (error) {
      const appError = handleError(error, 'loadUserProfile');
      showToast(appError.userMessage, 'error');
      setLoading(false);
    }
  };

  // ============================================
  // METHOD SELECTION
  // ============================================
  const selectMethod = (method: string) => {
    if (isProcessing) {
      showToast('Please wait until the current video generation is complete!', 'error');
      return;
    }

    setCurrentMethod(method);
    resetStages();

    if (method === 'computer') {
      initializeComputerUpload();
    } else if (method === 'library') {
      initializeLibrary();
    } else if (method === 'batch') {
      initializeBatch();
    }
  };

  const resetStages = () => {
    setSelectedImages([]);
    setAllImages([]);
    setImageSettings({});
    setUploadedImages([null, null, null, null]);
    setComputerSettings({});
    setLibraryImages([]);
    setLibrarySelectedImages([]);
    setLibrarySettings({});
    setLibraryDisplayCount(18);
    setBatchUrls([]);
    setBatchCurrentIndex(0);
    setBatchAllData([]);
    
    setStage2Active(false);
    setStage3Active(false);
    setStage4Active(false);
    setVideoPlayerActive(false);
    setComputerStage4Active(false);
    setComputerVideoPlayerActive(false);
    setLibraryGalleryActive(false);
    setLibrarySettingsActive(false);
    setLibraryStage4Active(false);
    setLibraryVideoPlayerActive(false);
    setBatchProcessScreenActive(false);
    
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    if (timerInterval) clearInterval(timerInterval);
  };

  const lockUI = () => {
    setIsProcessing(true);
  };

  const unlockUI = () => {
    setIsProcessing(false);
  };

  // ============================================
  // CREDIT CHECK
  // ============================================
  const checkCredits = (imageCount: number): boolean => {
    const requiredCredits = imageCount * 100;

    if (userCredits < requiredCredits) {
      showToast(
        `Insufficient credits! You need ${requiredCredits} credits but have ${userCredits}. Please go to user settings to add credits.`,
        'error'
      );
      return false;
    }

    return true;
  };

  // ============================================
  // FROM URL METHODS
  // ============================================
  const fetchImages = async () => {
    const url = productUrl.trim();
    
    if (!url) {
      showToast('Please enter a product URL!', 'error');
      return;
    }

    setStage1Loading(true);

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_FETCH_WEBHOOK!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl: url })
      });

      if (!response.ok) throw new Error('Could not fetch images');

      const data = await response.json();
      setAllImages(data.images || []);
      
      setStage1Loading(false);
      setStage2Active(true);
      
    } catch (error) {
      const appError = handleError(error, 'fetchImages');
      showToast(appError.userMessage, 'error');
      setStage1Loading(false);
    }
  };

  const toggleImage = (imageUrl: string) => {
    const isSelected = selectedImages.includes(imageUrl);
    
    if (isSelected) {
      setSelectedImages(selectedImages.filter(url => url !== imageUrl));
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
        creativity: 0.5
      };
    });
    setImageSettings(newSettings);

    setStage2Active(false);
    setStage3Active(true);
  };

  const generateVideo = async () => {
    if (selectedImages.length < 1) {
      showToast('Please select at least 1 image!', 'error');
      return;
    }

    if (!checkCredits(selectedImages.length)) {
      return;
    }

    lockUI();

    const productCode = urlProductCode.trim();
    const refNo = productCode 
      ? `${productCode}_${Math.floor(10000 + Math.random() * 90000)}`
      : `Ecom_Studio_video_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    
    setCurrentRefNo(refNo);

    setStage3Active(false);
    setStage4Active(true);
    startTimer();

    const payload = {
      userId: currentUserId,
      refNo: refNo,
      selectedImages: selectedImages,
      imageCount: selectedImages.length,
      settings: imageSettings
    };

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SAVE_WEBHOOK!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Could not start video generation');

      const result = await response.json();
      
      if (result.video_url) {
        showVideo(result.video_url, result.filename);
      } else if (result.status_url) {
        startStatusCheck(result.status_url, refNo);
      } else {
        showToast('Video generation started!', 'success');
      }
      
    } catch (error) {
      const appError = handleError(error, 'generateVideo');
      showToast(appError.userMessage, 'error');
      setStage4Active(false);
      stopTimer();
      unlockUI();
    }
  };

  const startTimer = () => {
    let seconds = 0;
    
    const interval = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setProcessingTimer(
        String(minutes).padStart(2, '0') + ':' + 
        String(secs).padStart(2, '0')
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
            userId: currentUserId
          })
        });

        if (!response.ok) throw new Error('Status check failed');

        const status = await response.json();
        
        if (status.status === 'completed' && status.video_url) {
          clearInterval(interval);
          showVideo(status.video_url, status.filename);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          unlockUI();
          showToast('Video generation failed.', 'error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          unlockUI();
          showToast('Process took too long. Please check status later.', 'error');
        }
      } catch (error) {
        if (attempts >= 3) {
          clearInterval(interval);
          unlockUI();
          showToast('Cannot check video status.', 'error');
        }
      }
    }, 10000);
    
    setStatusCheckInterval(interval);
  };

  const showVideo = (url: string, filename?: string) => {
    stopTimer();
    unlockUI();
    
    setVideoUrl(url);
    setStage4Active(false);
    setVideoPlayerActive(true);
    
    showToast('Video successfully created!', 'success');
  };

  // ============================================
  // FROM COMPUTER METHODS
  // ============================================
  const initializeComputerUpload = () => {
    setUploadedImages([null, null, null, null]);
    setComputerSettings({});
  };

  const handleFileSelect = async (index: number, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file!', 'error');
      return;
    }

    try {
      const timestamp = Date.now();
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const extension = file.name.split('.').pop();
      const filename = `computer_${timestamp}_${randomNum}.${extension}`;

      const uploadUrl = `${process.env.NEXT_PUBLIC_BUNNY_STORAGE_URL}/user-${currentUserId}/uploads/${filename}`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'AccessKey': process.env.NEXT_PUBLIC_BUNNY_ACCESS_KEY!,
          'Content-Type': 'application/octet-stream'
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const cdnUrl = `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/user-${currentUserId}/uploads/${filename}`;

      const newUploadedImages = [...uploadedImages];
      newUploadedImages[index] = {
        url: cdnUrl,
        filename: filename
      };
      setUploadedImages(newUploadedImages);

      if (!computerSettings[index]) {
        setComputerSettings({
          ...computerSettings,
          [index]: {
            imageUrl: cdnUrl,
            duration: '5',
            prompt: '',
            negativePrompt: '',
            creativity: 0.5
          }
        });
      }

      showToast('Image uploaded successfully!', 'success');

    } catch (error) {
      const appError = handleError(error, 'handleFileSelect');
      showToast(appError.userMessage, 'error');
    }
  };

  const generateFromComputer = async () => {
    const uploadCount = uploadedImages.filter(img => img).length;
    
    if (uploadCount < 1) {
      showToast('Please upload at least 1 image!', 'error');
      return;
    }

    if (!checkCredits(uploadCount)) {
      return;
    }

    lockUI();

    const productCode = computerProductCode.trim();
    const refNo = productCode 
      ? `${productCode}_${Math.floor(10000 + Math.random() * 90000)}`
      : `Ecom_Studio_video_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    
    setCurrentRefNo(refNo);

    setComputerStage4Active(true);
    startComputerTimer();

    const validImages = uploadedImages.filter(img => img) as UploadedImage[];
    const validSettings: Record<number, ImageSettings> = {};
    validImages.forEach((img, idx) => {
      validSettings[idx] = computerSettings[idx] || {
        imageUrl: img.url,
        duration: '5',
        prompt: '',
        negativePrompt: '',
        creativity: 0.5
      };
    });

    const payload = {
      userId: currentUserId,
      refNo: refNo,
      selectedImages: validImages.map(img => img.url),
      imageCount: validImages.length,
      settings: validSettings
    };

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SAVE_WEBHOOK!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Could not start video generation');

      const result = await response.json();
      
      if (result.video_url) {
        showComputerVideo(result.video_url, result.filename);
      } else if (result.status_url) {
        startComputerStatusCheck(result.status_url, refNo);
      } else {
        showToast('Video generation started!', 'success');
      }
      
    } catch (error) {
      const appError = handleError(error, 'generateFromComputer');
      showToast(appError.userMessage, 'error');
      setComputerStage4Active(false);
      stopComputerTimer();
      unlockUI();
    }
  };

  const startComputerTimer = () => {
    let seconds = 0;
    
    const interval = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setComputerProcessingTimer(
        String(minutes).padStart(2, '0') + ':' + 
        String(secs).padStart(2, '0')
      );
    }, 1000);
    
    setTimerInterval(interval);
  };

  const stopComputerTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const startComputerStatusCheck = (statusUrl: string, refNo: string) => {
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
            userId: currentUserId
          })
        });

        if (!response.ok) throw new Error('Status check failed');

        const status = await response.json();
        
        if (status.status === 'completed' && status.video_url) {
          clearInterval(interval);
          showComputerVideo(status.video_url, status.filename);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          unlockUI();
          showToast('Video generation failed.', 'error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          unlockUI();
          showToast('Process took too long.', 'error');
        }
      } catch (error) {
        if (attempts >= 3) {
          clearInterval(interval);
          unlockUI();
          showToast('Cannot check video status.', 'error');
        }
      }
    }, 10000);
    
    setStatusCheckInterval(interval);
  };

  const showComputerVideo = (url: string, filename?: string) => {
    stopComputerTimer();
    unlockUI();
    
    setComputerVideoUrl(url);
    setComputerStage4Active(false);
    setComputerVideoPlayerActive(true);
    
    showToast('Video successfully created!', 'success');
  };

  // ============================================
  // FROM LIBRARY METHODS
  // ============================================
  const initializeLibrary = async () => {
    setLibrarySelectedImages([]);
    setLibrarySettings({});
    setLibraryDisplayCount(18);
    
    setLibraryLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BUNNY_STORAGE_URL}/user-${currentUserId}/uploads/`, {
        method: 'GET',
        headers: { 'AccessKey': process.env.NEXT_PUBLIC_BUNNY_ACCESS_KEY! }
      });

      if (!response.ok) throw new Error('Could not load library');

      const data = await response.json();
      
      const images = data
        .filter((file: any) => !file.IsDirectory && 
                file.ObjectName.match(/\.(jpg|jpeg|png|gif|webp)$/i))
        .map((file: any) => ({
          url: `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/user-${currentUserId}/uploads/${file.ObjectName}`,
          thumbnail: `${process.env.NEXT_PUBLIC_BUNNY_CDN_URL}/user-${currentUserId}/uploads/${file.ObjectName}`,
          name: file.ObjectName,
          date: new Date(file.LastChanged)
        }))
        .sort((a: ImageData, b: ImageData) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

      setLibraryImages(images);
      setLibraryLoading(false);
      setLibraryGalleryActive(true);
      
    } catch (error) {
      const appError = handleError(error, 'initializeLibrary');
      showToast(appError.userMessage, 'error');
      setLibraryLoading(false);
    }
  };

  const toggleLibraryImage = (imageUrl: string) => {
    const isSelected = librarySelectedImages.includes(imageUrl);
    
    if (isSelected) {
      setLibrarySelectedImages(librarySelectedImages.filter(url => url !== imageUrl));
    } else {
      if (librarySelectedImages.length >= 4) {
        showToast('Maximum 4 images can be selected!', 'error');
        return;
      }
      setLibrarySelectedImages([...librarySelectedImages, imageUrl]);
    }
  };

  const confirmLibrarySelection = () => {
    if (librarySelectedImages.length < 1) {
      showToast('Please select at least 1 image!', 'error');
      return;
    }

    const newSettings: Record<number, ImageSettings> = {};
    librarySelectedImages.forEach((img, index) => {
      newSettings[index] = {
        imageUrl: img,
        duration: '5',
        prompt: '',
        negativePrompt: '',
        creativity: 0.5
      };
    });
    setLibrarySettings(newSettings);

    setLibraryGalleryActive(false);
    setLibrarySettingsActive(true);
  };

  const generateFromLibrary = async () => {
    if (librarySelectedImages.length < 1) {
      showToast('Please select at least 1 image!', 'error');
      return;
    }

    if (!checkCredits(librarySelectedImages.length)) {
      return;
    }

    lockUI();

    const productCode = libraryProductCode.trim();
    const refNo = productCode 
      ? `${productCode}_${Math.floor(10000 + Math.random() * 90000)}`
      : `Ecom_Studio_video_${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    
    setCurrentRefNo(refNo);

    setLibrarySettingsActive(false);
    setLibraryStage4Active(true);
    startLibraryTimer();

    const payload = {
      userId: currentUserId,
      refNo: refNo,
      selectedImages: librarySelectedImages,
      imageCount: librarySelectedImages.length,
      settings: librarySettings
    };

    try {
      const response = await fetch(process.env.NEXT_PUBLIC_SAVE_WEBHOOK!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Could not start video generation');

      const result = await response.json();
      
      if (result.video_url) {
        showLibraryVideo(result.video_url, result.filename);
      } else if (result.status_url) {
        startLibraryStatusCheck(result.status_url, refNo);
      } else {
        showToast('Video generation started!', 'success');
      }
      
    } catch (error) {
      const appError = handleError(error, 'generateFromLibrary');
      showToast(appError.userMessage, 'error');
      setLibraryStage4Active(false);
      stopLibraryTimer();
      unlockUI();
    }
  };

  const startLibraryTimer = () => {
    let seconds = 0;
    
    const interval = setInterval(() => {
      seconds++;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setLibraryProcessingTimer(
        String(minutes).padStart(2, '0') + ':' + 
        String(secs).padStart(2, '0')
      );
    }, 1000);
    
    setTimerInterval(interval);
  };

  const stopLibraryTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const startLibraryStatusCheck = (statusUrl: string, refNo: string) => {
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
            userId: currentUserId
          })
        });

        if (!response.ok) throw new Error('Status check failed');

        const status = await response.json();
        
        if (status.status === 'completed' && status.video_url) {
          clearInterval(interval);
          showLibraryVideo(status.video_url, status.filename);
        } else if (status.status === 'failed') {
          clearInterval(interval);
          unlockUI();
          showToast('Video generation failed.', 'error');
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          unlockUI();
          showToast('Process took too long.', 'error');
        }
      } catch (error) {
        if (attempts >= 3) {
          clearInterval(interval);
          unlockUI();
          showToast('Cannot check video status.', 'error');
        }
      }
    }, 10000);
    
    setStatusCheckInterval(interval);
  };

  const showLibraryVideo = (url: string, filename?: string) => {
    stopLibraryTimer();
    unlockUI();
    
    setLibraryVideoUrl(url);
    setLibraryStage4Active(false);
    setLibraryVideoPlayerActive(true);
    
    showToast('Video successfully created!', 'success');
  };

  // ============================================
  // BATCH PROCESSING METHODS
  // ============================================
  const initializeBatch = () => {
    setBatchUrls([]);
    setBatchCurrentIndex(0);
    setBatchAllData([]);
    setBatchFilename('No file chosen');
  };

  const handleExcelSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBatchFilename(file.name);
    } else {
      setBatchFilename('No file chosen');
    }
  };

const importExcel = async () => {
  const fileInput = document.getElementById('batchExcelFile') as HTMLInputElement;
  const file = fileInput?.files?.[0];
  
  if (!file) {
    showToast('Please select an Excel file!', 'error');
    return;
  }

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
    
    const urls: string[] = [];
    for (let i = 0; i < rows.length && i < 50; i++) {
      const url = rows[i]?.[0];
      if (url && typeof url === 'string' && url.trim() !== '') {
        if (url.includes('http') || url.includes('www')) {
          urls.push(url.trim());
        }
      }
    }
    
    if (urls.length === 0) {
      showToast('No valid URLs found in column A!', 'error');
      return;
    }
    
    setBatchUrls(urls);
    showToast(`${urls.length} URL(s) imported successfully!`, 'success');
    renderBatchUrlList(urls);
    
  } catch (error) {
    const appError = handleError(error, 'importExcel');
    showToast(appError.userMessage, 'error');
  }
};

  const generateBatchVideos = async () => {
    const completedCount = batchAllData.filter(data => data && data.selectedImages.length > 0).length;
    
    if (completedCount !== batchUrls.length || completedCount === 0) {
      showToast('Please complete all URL selections first!', 'error');
      return;
    }

    const totalImages = batchAllData.reduce((sum, data) => sum + data.selectedImages.length, 0);
    
    if (!checkCredits(totalImages)) {
      return;
    }

    lockUI();
    setBatchProcessScreenActive(true);

    const payloads = batchAllData.map((data, index) => {
      if (!data || data.selectedImages.length === 0) return null;

      const refNo = data.productCode 
        ? `${data.productCode}_${Math.floor(10000 + Math.random() * 90000)}`
        : `Ecom_Studio_video_${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      return {
        userId: currentUserId,
        refNo: refNo,
        selectedImages: data.selectedImages,
        imageCount: data.selectedImages.length,
        settings: data.settings
      };
    }).filter(p => p !== null);

    try {
      for (const payload of payloads) {
        const response = await fetch(process.env.NEXT_PUBLIC_SAVE_WEBHOOK!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          console.error('Failed to send payload:', payload);
        }
      }

      showToast(`${payloads.length} videos are being processed! You can leave this page.`, 'success');
      
      setTimeout(() => {
        unlockUI();
      }, 3000);
      
    } catch (error) {
      const appError = handleError(error, 'generateBatchVideos');
      showToast(appError.userMessage, 'error');
      unlockUI();
    }
  };

const renderBatchUrlList = async (urls: string[]) => {
  if (urls.length > 0) {
    await fetchBatchUrl(0, urls);
  }
};

const fetchBatchUrl = async (index: number, urls: string[]) => {
  if (index >= urls.length) return;
  
  const url = urls[index];
  
  try {
    const response = await fetch(process.env.NEXT_PUBLIC_FETCH_WEBHOOK!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productUrl: url })
    });

    if (!response.ok) throw new Error('Could not fetch images');

    const data = await response.json();
    const images = data.images || [];
    
    const newBatchData = [...batchAllData];
    newBatchData[index] = {
      url: url,
      images: images,
      selectedImages: [],
      productCode: '',
      settings: {}
    };
    setBatchAllData(newBatchData);
    
  } catch (error) {
    const appError = handleError(error, 'fetchBatchUrl');
    showToast(`Failed to fetch URL ${index + 1}: ${appError.userMessage}`, 'error');
  }
};

// Sonraki fonksiyonlar devam eder...

  if (loading) {
    return (
      <AuthenticatedLayout>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh',
          color: '#fff'
        }}>
          Loading...
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <div className="container">
        {/* METHOD SELECTOR */}
        <div className="method-selector">
          <h3>Please choose an upload method:</h3>
          <div className="method-cards">
            <div 
              className={`method-card ${currentMethod === 'computer' ? 'active' : currentMethod ? 'inactive' : ''}`}
              onClick={() => selectMethod('computer')}
            >
              <img src="/icon_method_from_computer.png" alt="From Computer" className="method-icon" />
              <div className="method-title">From Computer</div>
              <div className="method-subtitle">Upload images</div>
            </div>
            <div 
              className={`method-card ${currentMethod === 'library' ? 'active' : currentMethod ? 'inactive' : ''}`}
              onClick={() => selectMethod('library')}
            >
              <img src="/icon_method_from_library.png" alt="From Library" className="method-icon" />
              <div className="method-title">From Library</div>
              <div className="method-subtitle">Use saved images</div>
            </div>
            <div 
              className={`method-card ${currentMethod === 'url' ? 'active' : currentMethod ? 'inactive' : ''}`}
              onClick={() => selectMethod('url')}
            >
              <img src="/icon_method_from_url.png" alt="From URL" className="method-icon" />
              <div className="method-title">From URL</div>
              <div className="method-subtitle">Fetch from website</div>
            </div>
            <div 
              className={`method-card ${currentMethod === 'batch' ? 'active' : currentMethod ? 'inactive' : ''}`}
              onClick={() => selectMethod('batch')}
            >
              <img src="/icon_method_from_xls.png" alt="Batch Processing" className="method-icon" />
              <div className="method-title">Batch Processing</div>
              <div className="method-subtitle">from Excel file (Max. 50 URL)</div>
            </div>
          </div>
        </div>

        {/* METHOD: FROM COMPUTER */}
        {currentMethod === 'computer' && (
          <div className="method-content">
            <div className="recommendation-text">
              <strong>For better results,</strong> we recommend that you upload images that are similar in size and that you select and arrange images that are a continuation of each other.
            </div>

            <div className="upload-header">
              <div className="product-code-input">
                <label>Product Name / Code / Barcode:</label>
                <input 
                  type="text" 
                  value={computerProductCode}
                  onChange={(e) => setComputerProductCode(e.target.value)}
                  placeholder="(Optional)"
                />
              </div>
              <div className="upload-count">
                Please select up to 4 images: <strong>{uploadedImages.filter(img => img).length}/4</strong>
              </div>
            </div>

            <div className="upload-grid">
              {[0, 1, 2, 3].map((index) => {
                const isActive = index === uploadedImages.filter(img => img).length;
                const isUploaded = uploadedImages[index] !== null;
                
                return (
                  <div key={index} className={`upload-box ${isActive ? 'active' : ''} ${isUploaded ? 'uploaded' : ''}`}>
                    <div className="upload-box-title">{index + 1}. IMAGE</div>
                    <div 
                      className={`upload-area ${isUploaded ? 'uploaded' : ''}`}
                      onClick={() => {
                        if (isActive) {
                          const input = document.getElementById(`file-input-${index}`) as HTMLInputElement;
                          input?.click();
                        }
                      }}
                    >
                      <div className="upload-icon">+</div>
                      <div className="upload-text">Click here to<br />upload an image.</div>
                      {isUploaded && (
                        <img 
                          className="upload-preview" 
                          src={uploadedImages[index]?.url} 
                          alt="Uploaded image"
                        />
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
                    <div className={`upload-settings ${isUploaded ? '' : 'inactive'}`}>
                      <div className="duration-row">
                        <select 
                          className="duration-select"
                          onChange={(e) => {
                            setComputerSettings({
                              ...computerSettings,
                              [index]: {
                                ...computerSettings[index],
                                duration: e.target.value
                              }
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
              className={`btn-generate ${uploadedImages.filter(img => img).length >= 1 ? 'active' : ''}`}
              onClick={generateFromComputer}
              disabled={uploadedImages.filter(img => img).length < 1}
            >
              GENERATE MY VIDEO ({uploadedImages.filter(img => img).length * 100} CREDITS)
            </button>

            {computerStage4Active && (
              <div className="video-processing">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src="/Video_Process.gif" alt="Processing" />
                  <div className="timer-overlay">{computerProcessingTimer}</div>
                </div>
                <div className="processing-text-new">
                  <div className="processing-line-1">YOUR VIDEO IS BEING PROCESSED.</div>
                  <div className="processing-line-2">You may leave the page. This process will be interrupted.</div>
                  <div className="processing-line-3">
                    The entire video will appear on the{' '}
                    <Link href="/video-assets">Video Assets</Link> page.
                  </div>
                  <div className="processing-line-4">(This process will take approximately 2-3 minutes.)</div>
                </div>
              </div>
            )}

            {computerVideoPlayerActive && (
              <div className="video-player">
                <h2>Your Video is Ready!</h2>
                <video controls src={computerVideoUrl} />
                <div className="video-actions">
                  <a href={computerVideoUrl} className="download-btn" download>DOWNLOAD</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* METHOD: FROM LIBRARY */}
        {currentMethod === 'library' && (
          <div className="method-content">
            <div className="recommendation-text">
              <strong>For better results,</strong> we recommend that you upload images that are similar in size and that you select and arrange images that are a continuation of each other.
            </div>

            {libraryLoading && (
              <div className="loading active">
                <img src="/fetching.gif" alt="Loading" />
                <div className="loading-text">LOADING LIBRARY...</div>
              </div>
            )}

            {libraryGalleryActive && (
              <div className="gallery-container active">
                <div className="gallery-header">
                  <div className="product-code-input">
                    <label>Product Name / Code / Barcode:</label>
                    <input 
                      type="text" 
                      value={libraryProductCode}
                      onChange={(e) => setLibraryProductCode(e.target.value)}
                      placeholder="(Optional)"
                    />
                  </div>
                  <div className="selection-count">
                    Please select up to 4 images: <strong>{librarySelectedImages.length}/4</strong>
                  </div>
                </div>
                
                <div className="gallery">
                  {libraryImages.slice(0, libraryDisplayCount).map((img, index) => (
                    <div 
                      key={index}
                      className={`image-item ${librarySelectedImages.includes(img.url) ? 'selected' : ''}`}
                      onClick={() => toggleLibraryImage(img.url)}
                    >
                      <img src={img.thumbnail} alt={img.name} />
                      <div className="checkbox">✓</div>
                      <div className="image-number">
                        {librarySelectedImages.includes(img.url) 
                          ? librarySelectedImages.indexOf(img.url) + 1 
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>

                {libraryDisplayCount < libraryImages.length && (
                  <button 
                    className="btn-confirm active"
                    onClick={() => setLibraryDisplayCount(libraryDisplayCount + 18)}
                    style={{ marginBottom: '20px' }}
                  >
                    LOAD MORE IMAGES
                  </button>
                )}

                <button 
                  className={`btn-confirm ${librarySelectedImages.length >= 1 ? 'active' : ''}`}
                  onClick={confirmLibrarySelection}
                >
                  CONFIRM SELECTED IMAGES
                </button>
              </div>
            )}

            {librarySettingsActive && (
              <div className="settings-container active">
                <div className="settings-grid">
                  {[0, 1, 2, 3].map((index) => {
                    const isActive = index < librarySelectedImages.length;
                    const imgSrc = isActive ? librarySelectedImages[index] : '';
                    
                    return (
                      <div key={index} className={`setting-card ${!isActive ? 'inactive' : ''}`}>
                        <div className="card-header">
                          <div className="card-title">{index + 1}. IMAGE</div>
                          {imgSrc && <img src={imgSrc} className="card-image" alt={`Image ${index + 1}`} />}
                          
                          <div className="duration-row">
                            <select 
                              className="duration-select" 
                              disabled={!isActive}
                              onChange={(e) => {
                                setLibrarySettings({
                                  ...librarySettings,
                                  [index]: {
                                    ...librarySettings[index],
                                    duration: e.target.value
                                  }
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
                  className={`btn-generate ${librarySelectedImages.length >= 1 ? 'active' : ''}`}
                  onClick={generateFromLibrary}
                  disabled={librarySelectedImages.length < 1}
                >
                  GENERATE MY VIDEO ({librarySelectedImages.length * 100} CREDITS)
                </button>
              </div>
            )}

            {libraryStage4Active && (
              <div className="video-processing">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src="/Video_Process.gif" alt="Processing" />
                  <div className="timer-overlay">{libraryProcessingTimer}</div>
                </div>
                <div className="processing-text-new">
                  <div className="processing-line-1">YOUR VIDEO IS BEING PROCESSED.</div>
                  <div className="processing-line-2">You may leave the page. This process will be interrupted.</div>
                  <div className="processing-line-3">
                    The entire video will appear on the{' '}
                    <Link href="/video-assets">Video Assets</Link> page.
                  </div>
                  <div className="processing-line-4">(This process will take approximately 2-3 minutes.)</div>
                </div>
              </div>
            )}

            {libraryVideoPlayerActive && (
              <div className="video-player">
                <h2>Your Video is Ready!</h2>
                <video controls src={libraryVideoUrl} />
                <div className="video-actions">
                  <a href={libraryVideoUrl} className="download-btn" download>DOWNLOAD</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* METHOD: FROM URL */}
        {currentMethod === 'url' && (
          <div className="method-content">
            <div className="recommendation-text">
              <strong>For better results,</strong> we recommend that you upload images that are similar in size and that you select and arrange images that are a continuation of each other.
            </div>

            <div className="stage">
              <div className="input-section">
                <input 
                  type="text" 
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="Paste product URL here..." 
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') fetchImages();
                  }}
                />
                <button className="btn-fetch" onClick={fetchImages}>Fetch Images</button>
              </div>

              {stage1Loading && (
                <div className="loading active">
                  <img src="/fetching.gif" alt="Loading" />
                  <div className="loading-text">IMAGES ARE FETCHING...</div>
                </div>
              )}
            </div>

            {stage2Active && (
              <div className="gallery-container active">
                <div className="gallery-header">
                  <div className="product-code-input">
                    <label>Product Name / Code / Barcode:</label>
                    <input 
                      type="text" 
                      value={urlProductCode}
                      onChange={(e) => setUrlProductCode(e.target.value)}
                      placeholder="(Optional)"
                    />
                  </div>
                  <div className="selection-count">
                    Please select up to 4 images: <strong>{selectedImages.length}/4</strong>
                  </div>
                </div>
                
                <div className="gallery">
                  {allImages.map((img, index) => (
                    <div 
                      key={index}
                      className={`image-item ${selectedImages.includes(img.url) ? 'selected' : ''}`}
                      onClick={() => toggleImage(img.url)}
                    >
                      <img src={img.thumbnail} alt={`Product image ${index + 1}`} />
                      <div className="checkbox">✓</div>
                      <div className="image-number">
                        {selectedImages.includes(img.url) 
                          ? selectedImages.indexOf(img.url) + 1 
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  className={`btn-confirm ${selectedImages.length >= 1 ? 'active' : ''}`}
                  onClick={confirmSelection}
                >
                  CONFIRM SELECTED IMAGES
                </button>
              </div>
            )}

            {stage3Active && (
              <div className="settings-container active">
                <div className="settings-grid">
                  {[0, 1, 2, 3].map((index) => {
                    const isActive = index < selectedImages.length;
                    const imgSrc = isActive ? selectedImages[index] : '';
                    
                    return (
                      <div key={index} className={`setting-card ${!isActive ? 'inactive' : ''}`}>
                        <div className="card-header">
                          <div className="card-title">{index + 1}. IMAGE</div>
                          {imgSrc && <img src={imgSrc} className="card-image" alt={`Image ${index + 1}`} />}
                          
                          <div className="duration-row">
                            <select 
                              className="duration-select" 
                              disabled={!isActive}
                              onChange={(e) => {
                                setImageSettings({
                                  ...imageSettings,
                                  [index]: {
                                    ...imageSettings[index],
                                    duration: e.target.value
                                  }
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
              </div>
            )}

            {stage4Active && (
              <div className="video-processing">
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src="/Video_Process.gif" alt="Processing" />
                  <div className="timer-overlay">{processingTimer}</div>
                </div>
                <div className="processing-text-new">
                  <div className="processing-line-1">YOUR VIDEO IS BEING PROCESSED.</div>
                  <div className="processing-line-2">You may leave the page. This process will be interrupted.</div>
                  <div className="processing-line-3">
                    The entire video will appear on the{' '}
                    <Link href="/video-assets">Video Assets</Link> page.
                  </div>
                  <div className="processing-line-4">(This process will take approximately 2-3 minutes.)</div>
                </div>
              </div>
            )}

            {videoPlayerActive && (
              <div className="video-player">
                <h2>Your Video is Ready!</h2>
                <video controls src={videoUrl} />
                <div className="video-actions">
                  <a href={videoUrl} className="download-btn" download>DOWNLOAD</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* METHOD: BATCH PROCESSING */}
        {currentMethod === 'batch' && (
          <div className="method-content">
            <div className="recommendation-text">
              <strong>For better results,</strong> we recommend that you upload images that are similar in size and that you select and arrange images that are a continuation of each other.
            </div>

            <div className="batch-upload-section">
              <div className="batch-file-input">
                <label htmlFor="batchExcelFile" className="batch-choose-btn">Choose File</label>
                <input 
                  type="file" 
                  id="batchExcelFile" 
                  accept=".xls,.xlsx" 
                  style={{ display: 'none' }}
                  onChange={handleExcelSelect}
                />
                <span className="batch-filename">{batchFilename}</span>
                <button 
                  className="batch-import-btn" 
                  onClick={importExcel}
                  disabled={batchFilename === 'No file chosen'}
                >
                  Import
                </button>
              </div>
              <div className="batch-limit-text">
                Max. URL Limit is 50. It will only retrieve URLs from the first 50 rows in Excel.
              </div>
            </div>

            <div className="batch-url-list">
              {/* Batch URL items will be rendered here */}
            </div>

            <button 
              className={`batch-final-button ${batchAllData.filter(d => d?.selectedImages.length > 0).length === batchUrls.length && batchUrls.length > 0 ? 'active' : ''}`}
              onClick={generateBatchVideos}
            >
              GENERATE ({batchAllData.filter(d => d?.selectedImages.length > 0).length}) VIDEOS
            </button>

            {batchProcessScreenActive && (
              <div className="batch-process-screen">
                <img src="/Video_Process.gif" alt="Processing" style={{ width: '500px', height: '400px', margin: '0 auto 30px' }} />
                <div className="process-title">THE PROCESS HAS BEGUN.</div>
                <div className="process-subtitle">
                  Your videos will be uploaded to the Video Assets page as they are ready.
                </div>
                <div className="process-warning">
                  You can leave the page if you want. It doesn't stop the process.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .method-selector {
          text-align: center;
          margin-bottom: 50px;
        }

        .method-selector h3 {
          font-size: 18px;
          font-weight: 400;
          color: #999;
          margin-bottom: 30px;
          letter-spacing: 1px;
        }

        .method-cards {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .method-card {
          background: linear-gradient(to bottom, #313236, #1f1f22);
          border: 2px solid #333;
          border-radius: 15px;
          padding: 40px 20px;
          cursor: pointer;
          transition: all 0.3s;
          opacity: 1;
          position: relative;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        .method-card:hover {
          border-color: #0066ff;
          transform: translateY(-5px);
        }

        .method-card.inactive {
          opacity: 0.2;
          pointer-events: none;
        }

        .method-card.active {
          border-color: #0066ff;
          background: #2d3a4d;
          opacity: 1;
        }

        .method-icon {
          width: 160px;
          height: 120px;
          margin: 0 auto 20px;
          display: block;
          filter: grayscale(1);
          opacity: 0.5;
          transition: all 0.3s;
        }

        .method-card.active .method-icon {
          filter: grayscale(0);
          opacity: 1;
        }

        .method-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 8px;
        }

        .method-subtitle {
          font-size: 12px;
          color: #888;
        }

        .recommendation-text {
          text-align: center;
          color: #999;
          font-size: 28px;
          line-height: 1.6;
          margin: 30px auto 40px;
          max-width: 800px;
        }

        .recommendation-text strong {
          color: #fff;
        }

        .input-section {
          display: flex;
          gap: 15px;
          margin-bottom: 40px;
          align-items: center;
          justify-content: center;
        }

        input[type="text"] {
          width: 60%;
          max-width: 900px;
          padding: 18px 25px;
          background: transparent;
          border: 2px solid #333;
          border-radius: 12px;
          font-size: 16px;
          color: #ffffff;
          transition: border-color 0.3s;
        }

        input[type="text"]:focus {
          outline: none;
          border-color: #0066ff;
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

        .btn-fetch:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 102, 236, 0.4);
        }

        .btn-fetch:disabled {
          background: #444;
          cursor: not-allowed;
        }

        .loading {
          text-align: center;
          padding: 40px;
          display: none;
        }

        .loading.active {
          display: block;
        }

        .loading img {
          width: 80px;
          height: auto;
          margin-bottom: 15px;
        }

        .loading-text {
          font-size: 18px;
          color: #ffffff;
          font-weight: 500;
        }

        .gallery-container {
          background: #252525;
          border-radius: 15px;
          padding: 30px;
          margin-bottom: 30px;
          display: none;
        }

        .gallery-container.active {
          display: block;
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
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
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
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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

        .settings-container {
          display: none;
          margin-bottom: 30px;
        }

        .settings-container.active {
          display: block;
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

        .video-processing {
          text-align: center;
          padding: 60px 20px;
        }

        .video-processing img {
          width: 500px;
          height: 400px;
          margin: 0 auto 30px;
        }

        .timer-overlay {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.8);
          color: #fff;
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 24px;
          font-weight: bold;
        }

        .processing-text-new {
          text-align: center;
          line-height: 2;
        }

        .processing-line-1 {
          font-size: 18px;
          color: #95ff04;
          font-weight: 600;
        }

        .processing-line-2 {
          font-size: 18px;
          color: #fff;
        }

        .processing-line-3 {
          font-size: 18px;
          color: #fff;
        }

        .processing-line-3 a {
          color: #fff;
          text-decoration: underline;
          font-weight: bold;
        }

        .processing-line-4 {
          font-size: 18px;
          color: #00c6ff;
          font-weight: 600;
        }

        .video-player {
          margin-top: 30px;
          padding: 30px;
          background: #252525;
          border-radius: 15px;
          text-align: center;
        }

        .video-player h2 {
          text-align: center;
          margin-bottom: 25px;
          color: #00b00a;
          font-size: 28px;
        }

        .video-player video {
          width: 40%;
          max-width: 800px;
          margin: 0 auto;
          display: block;
          border-radius: 12px;
          background: #000;
        }

        .video-actions {
          text-align: center;
          margin-top: 25px;
        }

        .download-btn {
          background: #00b00a;
          padding: 18px 50px;
          font-size: 18px;
          font-weight: 600;
          text-decoration: none;
          display: inline-block;
          color: white;
          border-radius: 12px;
          transition: all 0.3s;
          border: none;
          cursor: pointer;
        }

        .download-btn:hover {
          background: #009008;
          transform: translateY(-2px);
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

        .batch-import-btn:hover {
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

        .batch-final-button {
          width: 100%;
          padding: 25px 50px;
          background: #444;
          color: #888;
          border: none;
          border-radius: 15px;
          font-size: 24px;
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

        .batch-process-screen {
          text-align: center;
          padding: 80px 20px;
        }

        .process-title {
          font-size: 36px;
          font-weight: 700;
          color: #00b00a;
          margin-bottom: 20px;
          letter-spacing: 2px;
        }

        .process-subtitle {
          font-size: 18px;
          color: #fff;
          line-height: 1.8;
          margin-bottom: 10px;
        }

        .process-warning {
          font-size: 18px;
          color: #ff00ff;
          font-weight: 600;
          margin-top: 20px;
        }

        @media (max-width: 1200px) {
          .method-cards {
            grid-template-columns: repeat(2, 1fr);
          }
          .upload-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .method-cards {
            grid-template-columns: 1fr;
          }
          .upload-grid {
            grid-template-columns: 1fr;
          }
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AuthenticatedLayout>
  );
}