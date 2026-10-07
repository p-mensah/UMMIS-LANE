import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Camera, 
  Scan, 
  Barcode, 
  CheckCircle2, 
  AlertTriangle, 
  Volume2, 
  VolumeX, 
  RefreshCw,
  Search
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { soundFeedback } from '../../lib/soundFeedback';

interface BarcodeScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onScanResult: (scannedCode: string) => void;
  title?: string;
}

export default function BarcodeScannerOverlay({
  isOpen,
  onClose,
  onScanResult,
  title = 'Warehouse Barcode Scanner'
}: BarcodeScannerOverlayProps) {
  const [activeMode, setActiveMode] = useState<'camera' | 'hardware'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [audioFeedbackEnabled, setAudioFeedbackEnabled] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // 1. Hardware Bluetooth / USB Barcode Scanner Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is manually typing into text inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          const barcode = bufferRef.current.trim();
          bufferRef.current = '';
          handleSuccessfulScan(barcode, 'Bluetooth Barcode Scanner');
        }
        bufferRef.current = '';
        return;
      }

      // If keys arrive in rapid succession (< 80ms), treat as hardware scanner
      if (e.key.length === 1) {
        if (timeDiff > 120) {
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 2. Camera Viewfinder with Html5Qrcode
  useEffect(() => {
    if (!isOpen || activeMode !== 'camera') {
      stopCamera();
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      try {
        setCameraError(null);
        const html5QrCode = new Html5Qrcode('tablet-camera-viewfinder');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.333
          },
          (decodedText) => {
            if (isMounted) {
              handleSuccessfulScan(decodedText, 'Device Camera Viewfinder');
            }
          },
          () => {
            // Frame parse error (common while scanning)
          }
        );

        if (isMounted) {
          setIsCameraActive(true);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Camera initiation failed:', err);
          setCameraError(err?.message || 'Unable to access camera. Please allow camera permissions or use hardware scanner.');
          setIsCameraActive(false);
        }
      }
    };

    const timer = setTimeout(startCamera, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      stopCamera();
    };
  }, [isOpen, activeMode]);

  const stopCamera = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
      setIsCameraActive(false);
    }
  };

  const handleSuccessfulScan = (code: string, source: string) => {
    if (audioFeedbackEnabled) {
      soundFeedback.playScanSuccess();
    }
    setScanStatus({
      type: 'success',
      message: `Scanned: "${code}" via ${source}`
    });

    setTimeout(() => {
      onScanResult(code);
      onClose();
    }, 400);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleSuccessfulScan(manualCode.trim(), 'Manual Key-in');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto select-none touch-manipulation">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <Scan size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">{title}</h3>
              <p className="text-[10px] text-slate-400">Bluetooth hardware & camera barcode capture</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAudioFeedbackEnabled(prev => !prev)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={audioFeedbackEnabled ? 'Audio confirmation enabled' : 'Muted'}
            >
              {audioFeedbackEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scan Status Toast / Confirmation Flash */}
        {scanStatus && (
          <div className={`p-3 text-xs font-bold flex items-center gap-2 border-b animate-in slide-in-from-top-1 duration-150 ${
            scanStatus.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="truncate">{scanStatus.message}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveMode('camera')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              activeMode === 'camera'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera size={14} />
            <span>Tablet Camera</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('hardware')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 transition border-b-2 cursor-pointer ${
              activeMode === 'hardware'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Barcode size={14} />
            <span>Bluetooth Scanner / Manual</span>
          </button>
        </div>

        {/* Main Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {activeMode === 'camera' ? (
            <div className="space-y-3">
              {/* Viewfinder Area */}
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center border-2 border-slate-800 shadow-inner">
                <div id="tablet-camera-viewfinder" className="w-full h-full" />

                {/* Laser Overlay animation */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center">
                    <div className="w-4/5 h-44 border-2 border-blue-400/80 rounded-xl relative shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                      {/* Laser red scan line */}
                      <div className="absolute left-2 right-2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse top-1/2 -translate-y-1/2" />
                      {/* Viewfinder corners */}
                      <span className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-blue-500" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-blue-500" />
                      <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-blue-500" />
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-blue-500" />
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 p-6 flex flex-col items-center justify-center text-center text-white space-y-3">
                    <AlertTriangle size={32} className="text-amber-400" />
                    <p className="text-xs text-slate-300 font-medium">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => setActiveMode('hardware')}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                    >
                      Use Manual / Bluetooth Mode
                    </button>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-slate-500 font-medium">
                Hold product barcode or QR code steadily inside the viewfinder
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bluetooth Scanner Listening Beacon */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Barcode size={22} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-950">Bluetooth Hardware Scanner Active</h4>
                  <p className="text-[11px] text-blue-800 font-medium">
                    Pull trigger on paired barcode scanner. Keypresses are captured automatically.
                  </p>
                </div>
              </div>

              {/* Manual Entry Fallback */}
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Or Key in Barcode / SKU manually:
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Enter SKU or Barcode (e.g. 'MLK-160', '890123')..."
                    className="w-full pl-10 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-2xs"
                  >
                    Lookup
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-medium">Ready for stock take & bin counts</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
