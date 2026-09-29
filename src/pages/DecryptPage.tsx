import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileLock2,
  Trash2,
  Unlock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertOctagon,
  Download,
  RefreshCw,
  Lock,
  ImageIcon,
} from 'lucide-react';
import {
  decryptEVC,
  inspectEVCHeader,
  formatBytes,
  type DecryptionResult,
  type EVCMetadata,
} from '../utils/crypto';

interface EVCFileDetails {
  file: File;
  buffer: ArrayBuffer;
  metadata?: EVCMetadata;
  headerValid: boolean;
  headerError?: string;
}

export const DecryptPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [evcDetails, setEvcDetails] = useState<EVCFileDetails | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Results
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionResult, setDecryptionResult] = useState<DecryptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [decryptedDimensions, setDecryptedDimensions] = useState<{ width: number; height: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File handling
  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setDecryptionResult(null);
    setDecryptedDimensions(null);

    if (!file.name.toLowerCase().endsWith('.evc')) {
      setErrorMessage('Invalid file extension. Please select a valid .EVC encrypted file.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const headerInfo = inspectEVCHeader(buffer);

      if (!headerInfo.valid) {
        setErrorMessage(headerInfo.error || 'Invalid EVC container file format.');
      }

      setEvcDetails({
        file,
        buffer,
        metadata: headerInfo.metadata,
        headerValid: headerInfo.valid,
        headerError: headerInfo.error,
      });
    } catch {
      setErrorMessage('Failed to read the uploaded .EVC file.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemoveFile = () => {
    if (decryptionResult?.objectUrl) {
      URL.revokeObjectURL(decryptionResult.objectUrl);
    }
    setEvcDetails(null);
    setDecryptionResult(null);
    setErrorMessage(null);
    setDecryptedDimensions(null);
    setPassword('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDecrypt = async () => {
    if (!evcDetails || !password || isDecrypting) return;

    setIsDecrypting(true);
    setErrorMessage(null);

    try {
      const result = await decryptEVC(evcDetails.buffer, password);

      // Load image dimensions
      const img = new Image();
      img.onload = () => {
        setDecryptedDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = result.objectUrl;

      setDecryptionResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Decryption failed due to invalid secret key or file corruption.';
      setErrorMessage(msg);
      setDecryptionResult(null);
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDownloadDecryptedImage = () => {
    if (!decryptionResult) return;
    const a = document.createElement('a');
    a.href = decryptionResult.objectUrl;
    a.download = decryptionResult.originalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleResetDecryptPage = () => {
    handleRemoveFile();
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
      
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Decrypt <span className="bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">EVC File</span>
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm sm:text-base">
          Upload an encrypted .EVC container and enter the secret key to authenticate and reconstruct the original image.
        </p>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
        <div className={`p-3 rounded-xl border ${evcDetails ? 'bg-purple-950/40 border-purple-500/40 text-purple-300' : 'glass-card text-slate-400'}`}>
          <div className="text-xs font-bold uppercase tracking-wider">STEP 01</div>
          <div className="text-sm font-semibold text-white">Upload .EVC</div>
        </div>
        <div className={`p-3 rounded-xl border ${password ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'glass-card text-slate-400'}`}>
          <div className="text-xs font-bold uppercase tracking-wider">STEP 02</div>
          <div className="text-sm font-semibold text-white">Enter Secret Key</div>
        </div>
        <div className={`p-3 rounded-xl border ${decryptionResult ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'glass-card text-slate-400'}`}>
          <div className="text-xs font-bold uppercase tracking-wider">STEP 03</div>
          <div className="text-sm font-semibold text-white">Decrypt</div>
        </div>
      </div>

      {/* Error Alert Card (e.g. Wrong Password or Corrupted File) */}
      {errorMessage && (
        <div className="glass-card p-6 rounded-2xl border-rose-500/40 bg-rose-950/30 text-rose-200 space-y-3 animate-fadeIn">
          <div className="flex items-center space-x-3 text-rose-400">
            <AlertOctagon className="w-6 h-6 flex-shrink-0" />
            <h3 className="font-bold text-lg text-white">Unable to Decrypt</h3>
          </div>
          <p className="text-sm text-rose-300 pl-9">
            {errorMessage}
          </p>
        </div>
      )}

      {!decryptionResult ? (
        <div className="space-y-8">
          
          {/* STEP 01 — UPLOAD .EVC */}
          <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h2 className="text-xl font-bold text-white">Upload .EVC Container</h2>
            </div>

            {!evcDetails ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/70 bg-slate-950/40 hover:bg-slate-900/60 rounded-2xl p-10 text-center cursor-pointer transition-all space-y-4 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  accept=".evc"
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-600/10 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileLock2 className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Drop your .EVC file here</p>
                  <p className="text-sm text-slate-400">or <span className="text-purple-400 font-semibold underline">click to browse</span></p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">
                  Accepts only encrypted .evc container files
                </p>
              </div>
            ) : (
              <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-6 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <FileLock2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">{evcDetails.file.name}</h3>
                      <div className="flex items-center space-x-3 text-xs text-slate-400 mt-1">
                        <span>Size: <strong className="text-slate-200">{formatBytes(evcDetails.file.size)}</strong></span>
                        {evcDetails.metadata && (
                          <span>Original: <strong className="text-blue-400">{evcDetails.metadata.originalName}</strong></span>
                        )}
                        <span className={evcDetails.headerValid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {evcDetails.headerValid ? '● Valid EVC Header' : '● Header Error'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleRemoveFile}
                    className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold flex items-center space-x-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove File</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* STEP 02 — SECRET KEY */}
          <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h2 className="text-xl font-bold text-white">Enter Secret Key</h2>
            </div>

            <div className="space-y-2 max-w-lg">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Secret Passphrase
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter the key used during encryption"
                  className="w-full px-4 py-3 rounded-xl glass-input pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                The password is derived locally via PBKDF2 to reconstruct the AES-GCM decryption key.
              </p>
            </div>
          </section>

          {/* STEP 03 — DECRYPT BUTTON */}
          <div className="pt-2">
            <button
              onClick={handleDecrypt}
              disabled={!evcDetails || !password || isDecrypting}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center space-x-3 ${
                !evcDetails || !password || isDecrypting
                  ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700/40'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white hover:shadow-purple-500/30 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {isDecrypting ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-white" />
                  <span>Decrypting payload...</span>
                </>
              ) : (
                <>
                  <Unlock className="w-6 h-6" />
                  <span>🔓 Decrypt Image</span>
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* DECRYPT SUCCESS CARD */
        <div className="glass-card p-8 rounded-3xl space-y-8 border-emerald-500/30 shadow-emerald-950/20 animate-fadeIn">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center glow-box-blue">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">✓ Image Successfully Decrypted</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              AES-GCM authentication tag verified. The original visual payload has been restored cleanly.
            </p>
          </div>

          {/* Recovered Image Display */}
          <div className="flex flex-col items-center space-y-4">
            <div className="max-w-xl max-h-96 rounded-2xl overflow-hidden border-2 border-emerald-500/30 bg-slate-950 shadow-2xl p-2">
              <img
                src={decryptionResult.objectUrl}
                alt="Decrypted original visual"
                className="w-full h-full object-contain rounded-xl max-h-80 mx-auto"
              />
            </div>
          </div>

          {/* Details Table */}
          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Original Filename</span>
              <span className="text-white font-semibold flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <span>{decryptionResult.originalName}</span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">File Type</span>
              <span className="text-blue-300 font-semibold">{decryptionResult.mimeType}</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">File Size</span>
              <span className="text-white font-semibold">{formatBytes(decryptionResult.size)}</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Dimensions</span>
              <span className="text-emerald-400 font-semibold">
                {decryptedDimensions ? `${decryptedDimensions.width} × ${decryptedDimensions.height} px` : 'Calculating...'}
              </span>
            </div>
          </div>

          {/* Download & Action Buttons */}
          <div className="space-y-4">
            <button
              onClick={handleDownloadDecryptedImage}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-lg shadow-xl shadow-emerald-950/50 flex items-center justify-center space-x-3 transition-all hover:scale-[1.01]"
            >
              <Download className="w-6 h-6" />
              <span>⬇ Download Image</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/encrypt')}
                className="flex-1 py-3 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-800/40 font-semibold text-sm flex items-center justify-center space-x-2 transition-all"
              >
                <Lock className="w-4 h-4" />
                <span>Encrypt Another Image</span>
              </button>

              <button
                onClick={handleResetDecryptPage}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-sm flex items-center justify-center space-x-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Decrypt Another File</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
