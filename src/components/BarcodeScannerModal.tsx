import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, Upload, Sparkles, Volume2, VolumeX, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedCode: string) => void;
  title?: string;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'QR & Barcode Camera Scanner'
}: BarcodeScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'file' | 'manual'>('camera');
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [manualCode, setManualCode] = useState<string>('');

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-viewport';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setLastScanned(null);
      setScanError(null);
      return;
    }

    if (activeTab === 'camera') {
      initCameraScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, activeTab, selectedCameraId]);

  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Audio permissions
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping QR scanner:', err);
      } finally {
        html5QrcodeRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const initCameraScanner = async () => {
    setScanError(null);
    try {
      // Get available cameras
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        const preferredCam = selectedCameraId || devices[devices.length - 1].id; // Prefer back camera if available
        if (!selectedCameraId) setSelectedCameraId(preferredCam);

        await startScanningWithCamera(preferredCam);
      } else {
        setScanError('No camera devices detected on this device.');
      }
    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      if (err?.name === 'NotAllowedError' || err?.toString().includes('Permission')) {
        setScanError('Camera access denied. Please grant browser camera permissions or try uploading a barcode image or manual SKU entry.');
      } else {
        setScanError(err?.message || 'Unable to access camera stream. Check camera permissions.');
      }
    }
  };

  const startScanningWithCamera = async (cameraId: string) => {
    await stopScanner();

    try {
      const html5Qrcode = new Html5Qrcode(scannerContainerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });

      html5QrcodeRef.current = html5Qrcode;

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 180 },
        aspectRatio: 1.3333
      };

      await html5Qrcode.start(
        cameraId,
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // Ignore frequent frame scan misses
        }
      );

      setIsScanning(true);
      setScanError(null);
    } catch (err: any) {
      console.error('Failed to start camera scan:', err);
      setIsScanning(false);
      setScanError('Could not start live video stream. Try selecting another camera or use manual input.');
    }
  };

  const handleSuccessfulScan = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    playBeep();
    setLastScanned(cleanCode);
    onScanSuccess(cleanCode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    try {
      const html5Qrcode = new Html5Qrcode('file-qr-temp');
      const decodedText = await html5Qrcode.scanFile(file, true);
      handleSuccessfulScan(decodedText);
      html5Qrcode.clear();
    } catch (err: any) {
      setScanError('Could not read QR/Barcode from selected image file. Ensure barcode is clear.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleSuccessfulScan(manualCode.trim());
      setManualCode('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-md max-w-lg w-full overflow-hidden border border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">{title}</h3>
              <p className="text-[10px] text-slate-400">Position barcode/QR inside target box</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800"
              title={soundEnabled ? 'Mute Beep Sound' : 'Enable Beep Sound'}
            >
              {soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} />}
            </button>
            <button
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'camera'
                ? 'border-blue-600 text-blue-600 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Camera size={14} /> Live Camera
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'file'
                ? 'border-blue-600 text-blue-600 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Upload size={14} /> Upload Image
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'manual'
                ? 'border-blue-600 text-blue-600 bg-white font-black'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} /> Manual / Test
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-4">
          {/* CAMERA TAB */}
          {activeTab === 'camera' && (
            <div className="space-y-3">
              {cameras.length > 1 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Select Camera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startScanningWithCamera(e.target.value);
                    }}
                    className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-bold text-slate-800"
                  >
                    {cameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Camera ${c.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Viewport Container */}
              <div className="relative bg-slate-950 rounded-sm overflow-hidden min-h-[260px] flex items-center justify-center border border-slate-800 shadow-inner">
                <div id={scannerContainerId} className="w-full"></div>

                {!isScanning && !scanError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-2 bg-slate-950">
                    <RefreshCw size={24} className="animate-spin text-blue-500" />
                    <span className="text-xs font-bold">Initializing camera stream...</span>
                  </div>
                )}

                {scanError && (
                  <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-900 text-white space-y-3">
                    <AlertCircle size={32} className="text-amber-400" />
                    <p className="text-xs font-medium text-slate-300 max-w-xs">{scanError}</p>
                    <button
                      onClick={() => initCameraScanner()}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Retry Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FILE UPLOAD TAB */}
          {activeTab === 'file' && (
            <div className="space-y-3">
              <div id="file-qr-temp" className="hidden"></div>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors bg-slate-50 flex flex-col items-center justify-center space-y-3">
                <Upload size={32} className="text-blue-500" />
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Select Barcode Image</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Upload a photo containing a clear barcode or QR code</p>
                </div>
                <label className="cursor-pointer px-4 py-2 bg-slate-900 hover:bg-blue-600 text-white rounded text-xs font-bold uppercase tracking-wider transition-colors">
                  Choose File
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* MANUAL / TEST TAB */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Enter SKU, Barcode, or Product ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="e.g., BAR-1002, SKU-MILK-102..."
                    className="flex-1 border border-slate-300 rounded px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded transition-colors"
                  >
                    Submit
                  </button>
                </div>
              </form>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  Quick Demo Barcodes (Click to test):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['BAR-1001', 'BAR-1002', 'BAR-1003', 'SKU-RICE-01', 'SKU-OIL-02'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => handleSuccessfulScan(sample)}
                      className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 text-slate-700 hover:text-blue-600 text-[11px] font-mono font-bold rounded transition-colors"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Last Scanned Feedback Banner */}
          {lastScanned && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 flex items-center justify-between text-xs font-bold animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  Scanned Code: <strong className="font-mono text-emerald-950">{lastScanned}</strong>
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-emerald-200/60 px-2 py-0.5 rounded text-emerald-900">
                Success
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs uppercase tracking-wider rounded transition-colors"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
}
