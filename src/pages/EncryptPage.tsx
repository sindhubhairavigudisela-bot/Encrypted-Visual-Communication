import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Image as ImageIcon,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import {
  encryptImage,
  getPasswordStrength,
  generateSecurePassword,
  formatBytes,
  type EncryptionResult,
} from '../utils/crypto';

interface ImageDetails {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

export const EncryptPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [imageDetails, setImageDetails] = useState<ImageDetails | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password Generator State
  const [isPasswordGenerated, setIsPasswordGenerated] = useState(false);
  const [hasCopiedPassword, setHasCopiedPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showGeneratedPassword, setShowGeneratedPassword] = useState(true);
  const [showUncopiedWarningModal, setShowUncopiedWarningModal] = useState(false);

  // Status & Progress
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [encryptionResult, setEncryptionResult] = useState<EncryptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  // Password Strength
  const strength = getPasswordStrength(password);

  // Validation
  const isPasswordValid =
    password.length >= 8 && password === confirmPassword;

  const getPasswordError = (): string | null => {
    if (!password) return null;
    if (password.length < 8) return 'Password must be at least 8 characters long.';
    if (confirmPassword && password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const passwordError = getPasswordError();

  // Password Generator Handler
  const handleGeneratePassword = () => {
    const newPassword = generateSecurePassword(24);
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setIsPasswordGenerated(true);
    setHasCopiedPassword(false);
    setCopySuccess(false);
    setShowGeneratedPassword(true);
    setShowPassword(true);
    setShowConfirmPassword(true);
    setErrorMessage(null);
  };

  // Copy Password Handler
  const handleCopyPassword = async () => {
    if (!password) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(password);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = password;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setHasCopiedPassword(true);
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2500);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  // Switch to Manual Password Entry
  const handleSwitchToManual = () => {
    setIsPasswordGenerated(false);
    setHasCopiedPassword(false);
    setCopySuccess(false);
    setPassword('');
    setConfirmPassword('');
  };

  // File handle logic
  const handleFileSelect = (file: File) => {
    setErrorMessage(null);
    setEncryptionResult(null);

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Unsupported file format. Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('File is too large. Please choose an image below 20 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImageDetails({
        file,
        previewUrl: objectUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = objectUrl;
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

  const handleRemoveImage = () => {
    if (imageDetails) {
      URL.revokeObjectURL(imageDetails.previewUrl);
    }
    setImageDetails(null);
    setEncryptionResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Encryption execution
  const executeEncryption = async () => {
    if (!imageDetails || !isPasswordValid || isEncrypting) return;

    setIsEncrypting(true);
    setErrorMessage(null);

    try {
      const result = await encryptImage(
        imageDetails.file,
        password,
        async (step) => {
          setProgressStatus(step);
          await new Promise((res) => setTimeout(res, 200));
        }
      );
      setEncryptionResult(result);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage('Encryption failed due to an unexpected browser crypto error.');
    } finally {
      setIsEncrypting(false);
    }
  };

  // Triggered when user clicks "Encrypt Image"
  const handleEncryptClick = () => {
    if (!imageDetails || !isPasswordValid || isEncrypting) return;

    // Warn if password was generated but has not been copied or saved yet
    if (isPasswordGenerated && !hasCopiedPassword) {
      setShowUncopiedWarningModal(true);
      return;
    }

    executeEncryption();
  };

  const handleDownloadEVC = () => {
    if (!encryptionResult) return;
    const url = URL.createObjectURL(encryptionResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = encryptionResult.evcFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    handleRemoveImage();
    setPassword('');
    setConfirmPassword('');
    setIsPasswordGenerated(false);
    setHasCopiedPassword(false);
    setCopySuccess(false);
    setEncryptionResult(null);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
      
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Encrypt <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Image</span>
        </h1>
        <p className="text-slate-400 max-w-lg mx-auto text-sm sm:text-base">
          Transform your visual file into a secure .EVC container using 256-bit AES-GCM local authenticated encryption.
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center space-x-3 text-sm animate-fadeIn">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Step Stepper Header */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
        <div className={`p-3 rounded-xl border ${imageDetails ? 'bg-blue-950/40 border-blue-500/40 text-blue-300' : 'glass-card text-slate-400'}`}>
          <div className="text-xs font-bold uppercase tracking-wider">STEP 01</div>
          <div className="text-sm font-semibold text-white">Select Image</div>
        </div>
        <div className={`p-3 rounded-xl border ${isPasswordValid ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'glass-card text-slate-400'}`}>
          <div className="text-xs font-bold uppercase tracking-wider">STEP 02</div>
          <div className="text-sm font-semibold text-white">Secure With Key</div>
        </div>
        <div className={`p-3 rounded-xl border ${encryptionResult ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'glass-card text-slate-400'}`}>
          <div className="text-xs font-bold uppercase tracking-wider">STEP 03</div>
          <div className="text-sm font-semibold text-white">Encrypt & Download</div>
        </div>
      </div>

      {!encryptionResult ? (
        <div className="space-y-8">
          
          {/* STEP 01 — IMAGE SELECTION */}
          <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h2 className="text-xl font-bold text-white">Select Image</h2>
            </div>

            {!imageDetails ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-500/30 hover:border-blue-400/70 bg-slate-950/40 hover:bg-slate-900/60 rounded-2xl p-10 text-center cursor-pointer transition-all space-y-4 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-600/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">Drop your image here</p>
                  <p className="text-sm text-slate-400">or <span className="text-blue-400 font-semibold underline">click to browse</span></p>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">
                  Supported: JPG, JPEG, PNG, WEBP (Max 20 MB)
                </p>
              </div>
            ) : (
              <div className="bg-slate-950/70 rounded-2xl p-4 sm:p-6 border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Image Preview Thumbnail */}
                  <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-blue-500/30 bg-slate-900 flex-shrink-0 group">
                    <img
                      src={imageDetails.previewUrl}
                      alt="Selected preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Metadata Info */}
                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start space-x-2">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <h3 className="font-bold text-white truncate max-w-xs">{imageDetails.file.name}</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 max-w-sm">
                      <div>File Type: <span className="text-slate-200 font-semibold">{imageDetails.file.type || 'Unknown'}</span></div>
                      <div>File Size: <span className="text-slate-200 font-semibold">{formatBytes(imageDetails.file.size)}</span></div>
                      <div>Dimensions: <span className="text-slate-200 font-semibold">{imageDetails.width} × {imageDetails.height} px</span></div>
                      <div>Status: <span className="text-emerald-400 font-semibold">Ready for encryption</span></div>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={handleRemoveImage}
                    className="px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-bold flex items-center space-x-2 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove Image</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* STEP 02 — SECRET KEY */}
          <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Secure With Key</h2>
                  <p className="text-xs text-slate-400">Provide a passphrase or generate a cryptographically secure key.</p>
                </div>
              </div>

              {/* Generate Secure Password Button */}
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-900/40 hover:shadow-purple-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all border border-purple-400/30"
              >
                <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
                <span>Generate Secure Password</span>
              </button>
            </div>

            {/* GENERATED PASSWORD DISPLAY CARD (Shows when password is automatically generated) */}
            {isPasswordGenerated && (
              <div className="p-5 rounded-2xl bg-gradient-to-b from-purple-950/40 to-slate-950/80 border border-purple-500/40 space-y-4 shadow-xl shadow-purple-950/30 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Generated Secure Key
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                      24 chars • Cryptographically Random
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowGeneratedPassword(!showGeneratedPassword)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors"
                      title={showGeneratedPassword ? 'Hide password' : 'Show password'}
                    >
                      {showGeneratedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showGeneratedPassword ? 'Hide' : 'Show'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 text-xs font-medium border border-purple-700/60 transition-colors"
                      title="Regenerate another password"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Regenerate</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSwitchToManual}
                      className="text-xs text-slate-400 hover:text-slate-200 underline pl-1"
                    >
                      Manual entry
                    </button>
                  </div>
                </div>

                {/* Password Box & Copy Action */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 px-4 py-3 rounded-xl bg-slate-950/90 border border-purple-500/30 font-mono text-sm sm:text-base tracking-wider text-purple-200 break-all select-all flex items-center justify-between">
                    <span>
                      {showGeneratedPassword ? password : '•'.repeat(password.length || 24)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className={`px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all ${
                      copySuccess
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-200" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Password</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Guidance Message & Warning Notice */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <p className="text-slate-300 leading-relaxed">
                    <span className="font-bold text-white">Security Guidance: </span>
                    Your password is generated securely. Save it safely and share it with the intended receiver through a separate trusted channel. Without the correct password, the encrypted image cannot be recovered.
                  </p>
                  
                  <div className="flex items-center space-x-2 pt-1 border-t border-slate-900 text-[11px]">
                    {hasCopiedPassword ? (
                      <span className="text-emerald-400 font-semibold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Password copied to clipboard. (Tip: Store it in a secure password manager or offline vault).</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>Password not copied yet. Remember to copy and record it before encrypting.</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Secret Key Input Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Secret Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Secret Key
                  </label>
                  {isPasswordGenerated && (
                    <span className="text-[10px] text-cyan-400 font-medium">Auto-filled by generator</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setIsPasswordGenerated(false);
                      setHasCopiedPassword(false);
                    }}
                    placeholder="Enter secret passphrase"
                    className="w-full px-4 py-3 rounded-xl glass-input pr-10 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Secret Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Confirm Secret Key
                  </label>
                  {isPasswordGenerated && (
                    <span className="text-[10px] text-cyan-400 font-medium">Auto-matched</span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setIsPasswordGenerated(false);
                      setHasCopiedPassword(false);
                    }}
                    placeholder="Re-enter secret passphrase"
                    className="w-full px-4 py-3 rounded-xl glass-input pr-10 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Password Validation & Strength Bar */}
            {password && (
              <div className="space-y-3 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400">Password Strength:</span>
                  <span
                    className={
                      strength.score === 'very-strong'
                        ? 'text-cyan-400 font-extrabold flex items-center space-x-1'
                        : strength.score === 'strong'
                        ? 'text-emerald-400 font-bold'
                        : strength.score === 'medium'
                        ? 'text-amber-400 font-bold'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    {strength.score === 'very-strong' && <ShieldCheck className="w-4 h-4 text-cyan-400 inline" />}
                    <span>{strength.label}</span>
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      strength.score === 'very-strong'
                        ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400'
                        : strength.score === 'strong'
                        ? 'bg-emerald-500'
                        : strength.score === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${strength.percentage}%` }}
                  />
                </div>

                {strength.feedback && (
                  <p className="text-[11px] text-slate-400">
                    {strength.feedback}
                  </p>
                )}

                {passwordError && (
                  <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4" />
                    <span>{passwordError}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* STEP 03 — ENCRYPT BUTTON */}
          <div className="pt-2">
            <button
              onClick={handleEncryptClick}
              disabled={!imageDetails || !isPasswordValid || isEncrypting}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center space-x-3 ${
                !imageDetails || !isPasswordValid || isEncrypting
                  ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700/40'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {isEncrypting ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-white" />
                  <span>{progressStatus || 'Encrypting Image...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  <span>🔒 Encrypt Image</span>
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* ENCRYPTION SUCCESS CARD */
        <div className="glass-card p-8 rounded-3xl space-y-8 border-emerald-500/30 shadow-emerald-950/20 animate-fadeIn">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center glow-box-blue">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">✓ Image Encrypted Successfully</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Your image has been converted into an authenticated .EVC container payload.
            </p>
          </div>

          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Original File</span>
              <span className="text-white font-semibold">{encryptionResult.originalName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Encrypted File</span>
              <span className="text-blue-400 font-semibold">{encryptionResult.evcFileName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Algorithm</span>
              <span className="text-purple-300 font-semibold">AES-GCM (256-bit)</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Key Derivation</span>
              <span className="text-purple-300 font-semibold">PBKDF2 (SHA-256)</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Encrypted Size</span>
              <span className="text-white font-semibold">{formatBytes(encryptionResult.encryptedSize)}</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Processing</span>
              <span className="text-emerald-400 font-semibold">Local Browser (Zero Server)</span>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleDownloadEVC}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-lg shadow-xl shadow-emerald-950/50 flex items-center justify-center space-x-3 transition-all hover:scale-[1.01]"
            >
              <Download className="w-6 h-6" />
              <span>⬇ Download .EVC File</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-sm flex items-center justify-center space-x-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Encrypt Another Image</span>
              </button>

              <button
                onClick={() => navigate('/decrypt')}
                className="flex-1 py-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 font-semibold text-sm flex items-center justify-center space-x-2 transition-all"
              >
                <span>Go to Decrypt</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WARNING MODAL: UNCOPIED GENERATED PASSWORD */}
      {showUncopiedWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card border border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl shadow-amber-950/40">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="w-12 h-12 rounded-2xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Save Your Generated Password</h3>
                <p className="text-xs text-amber-300/80">You have not copied or recorded this key yet.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Your password is generated securely. Save it safely and share it with the intended receiver through a separate trusted channel. Without the correct password, the encrypted image cannot be recovered.
              </p>
              <p className="text-[11px] text-slate-400 italic">
                Note: Copying places the key on your clipboard for immediate transfer, but clipboard contents can be lost or overwritten. Please ensure you store it safely in an encrypted password manager or offline vault.
              </p>
            </div>

            {/* Password Preview Box inside Modal */}
            <div className="px-4 py-3 rounded-xl bg-slate-900 border border-purple-500/30 font-mono text-sm tracking-wider text-purple-300 break-all select-all">
              {password}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={async () => {
                  await handleCopyPassword();
                  setShowUncopiedWarningModal(false);
                  executeEncryption();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-950/50"
              >
                <Copy className="w-4 h-4" />
                <span>Copy & Proceed to Encrypt</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setHasCopiedPassword(true);
                  setShowUncopiedWarningModal(false);
                  executeEncryption();
                }}
                className="py-3 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-semibold text-xs sm:text-sm transition-colors border border-slate-700"
              >
                Proceed Without Copying
              </button>

              <button
                type="button"
                onClick={() => setShowUncopiedWarningModal(false)}
                className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold text-xs sm:text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
