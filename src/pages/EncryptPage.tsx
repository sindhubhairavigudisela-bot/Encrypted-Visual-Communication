import React, { useState, useRef, useEffect } from 'react';
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
  Shuffle,
  Key,
  Cpu,
} from 'lucide-react';
import {
  encryptImage,
  encryptImageRSA,
  encryptPixelShuffleEVC,
  generateRSAKeyPair,
  exportRSAPublicKeyPEM,
  importRSAPublicKeyPEM,
  exportProtectedRSAPrivateKeyPEM,
  getPasswordStrength,
  generateSecurePassword,
  formatBytes,
  type AESKeySize,
  type RSAKeySize,
  type EncryptionMethod,
  type EncryptionType,
  type EncryptionResult,
} from '../utils/crypto.ts';

import {
  fileToImageData,
  shuffleImageData,
  imageDataToBlob,
} from '../utils/pixelShuffle.ts';

interface ImageDetails {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  imageData?: ImageData;
}

export const EncryptPage: React.FC = () => {
  const navigate = useNavigate();

  // Method & Type Selection
  const [selectedMethod, setSelectedMethod] = useState<EncryptionMethod>('standard');
  const [encryptionType, setEncryptionType] = useState<EncryptionType>('symmetric');

  // Key sizes
  const [aesKeySize, setAesKeySize] = useState<AESKeySize>(256);
  const [rsaKeySize, setRsaKeySize] = useState<RSAKeySize>(2048);

  // Image State
  const [imageDetails, setImageDetails] = useState<ImageDetails | null>(null);

  // Symmetric Password State
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

  // RSA Asymmetric State
  const [recipientPublicKeyPEM, setRecipientPublicKeyPEM] = useState('');
  const [importedPublicKey, setImportedPublicKey] = useState<CryptoKey | null>(null);
  const [publicKeyError, setPublicKeyError] = useState<string | null>(null);

  // RSA Key Generation Tool State
  const [isGeneratingKeyPair, setIsGeneratingKeyPair] = useState(false);
  const [generatedKeyPairPEMs, setGeneratedKeyPairPEMs] = useState<{
    publicPEM: string;
    privateKey: CryptoKey;
  } | null>(null);
  const [privateKeyPassphrase, setPrivateKeyPassphrase] = useState('');
  const [showPrivPassphrase, setShowPrivPassphrase] = useState(false);
  const [copiedPublicSuccess, setCopiedPublicSuccess] = useState(false);
  const [keyGenSuccessNotice, setKeyGenSuccessNotice] = useState<string | null>(null);

  // Pixel Shuffle State
  const [isShuffling, setIsShuffling] = useState(false);
  const [scrambledImageUrl, setScrambledImageUrl] = useState<string | null>(null);
  const [scrambledBlob, setScrambledBlob] = useState<Blob | null>(null);
  const [protectShuffleWithAES, setProtectShuffleWithAES] = useState(true);

  // Status & Progress
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [encryptionResult, setEncryptionResult] = useState<EncryptionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const publicKeyFileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

  // Password Strength
  const strength = getPasswordStrength(password);

  // Validation
  const isSymmetricValid = password.length >= 8 && password === confirmPassword;
  const isRSAValid = encryptionType === 'asymmetric' ? importedPublicKey !== null : true;
  const isFormValid =
    imageDetails !== null &&
    (selectedMethod === 'pixel-shuffle'
      ? password.length >= 8 && scrambledBlob !== null
      : encryptionType === 'symmetric'
      ? isSymmetricValid
      : isRSAValid);

  // Validate Public Key PEM when typed/pasted
  useEffect(() => {
    if (!recipientPublicKeyPEM.trim()) {
      setImportedPublicKey(null);
      setPublicKeyError(null);
      return;
    }
    importRSAPublicKeyPEM(recipientPublicKeyPEM)
      .then((key) => {
        setImportedPublicKey(key);
        setPublicKeyError(null);
      })
      .catch(() => {
        setImportedPublicKey(null);
        setPublicKeyError('Invalid RSA Public Key. Please ensure valid SPKI PEM format.');
      });
  }, [recipientPublicKeyPEM]);

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
      setTimeout(() => setCopySuccess(false), 2500);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleSwitchToManual = () => {
    setIsPasswordGenerated(false);
    setHasCopiedPassword(false);
    setCopySuccess(false);
    setPassword('');
    setConfirmPassword('');
  };

  // Image Selection Handler
  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setEncryptionResult(null);
    setScrambledImageUrl(null);
    setScrambledBlob(null);

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Unsupported file format. Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('File is too large. Please choose an image below 20 MB.');
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const { imageData, width, height } = await fileToImageData(file);
      setImageDetails({
        file,
        previewUrl: objectUrl,
        width,
        height,
        imageData,
      });
    } catch {
      setErrorMessage('Failed to decode image data.');
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleRemoveImage = () => {
    if (imageDetails) URL.revokeObjectURL(imageDetails.previewUrl);
    if (scrambledImageUrl) URL.revokeObjectURL(scrambledImageUrl);
    setImageDetails(null);
    setScrambledImageUrl(null);
    setScrambledBlob(null);
    setEncryptionResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // RSA Key Generation Actions
  const handleGenerateRSAKeys = async () => {
    setIsGeneratingKeyPair(true);
    setKeyGenSuccessNotice(null);
    try {
      const keyPair = await generateRSAKeyPair(rsaKeySize);
      const pubPem = await exportRSAPublicKeyPEM(keyPair.publicKey);
      setGeneratedKeyPairPEMs({
        publicPEM: pubPem,
        privateKey: keyPair.privateKey,
      });
      setKeyGenSuccessNotice(`Generated new RSA-${rsaKeySize} key pair.`);
    } catch {
      setErrorMessage('Failed to generate RSA key pair.');
    } finally {
      setIsGeneratingKeyPair(false);
    }
  };

  const handleDownloadGeneratedPublicKey = () => {
    if (!generatedKeyPairPEMs) return;
    const blob = new Blob([generatedKeyPairPEMs.publicPEM], { type: 'application/x-pem-file' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evc_rsa_${rsaKeySize}_public.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadProtectedPrivateKey = async () => {
    if (!generatedKeyPairPEMs) return;
    if (!privateKeyPassphrase || privateKeyPassphrase.length < 8) {
      setErrorMessage('A passphrase of at least 8 characters is required to protect and export the private key.');
      return;
    }
    try {
      const protectedPem = await exportProtectedRSAPrivateKeyPEM(
        generatedKeyPairPEMs.privateKey,
        privateKeyPassphrase
      );
      const blob = new Blob([protectedPem], { type: 'application/x-pem-file' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evc_rsa_${rsaKeySize}_private_encrypted.pem`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setErrorMessage(null);
    } catch {
      setErrorMessage('Failed to export protected private key.');
    }
  };

  // Pixel Shuffle Action
  const handleShufflePixels = async () => {
    if (!imageDetails?.imageData) {
      setErrorMessage('Please select an image first.');
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage('Secret key of at least 8 characters is required for deterministic pixel shuffling.');
      return;
    }

    setIsShuffling(true);
    setErrorMessage(null);
    try {
      const scrambledData = await shuffleImageData(imageDetails.imageData, password);
      const blob = await imageDataToBlob(scrambledData);
      if (scrambledImageUrl) URL.revokeObjectURL(scrambledImageUrl);
      const url = URL.createObjectURL(blob);
      setScrambledBlob(blob);
      setScrambledImageUrl(url);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage('Failed to shuffle image pixels.');
    } finally {
      setIsShuffling(false);
    }
  };

  const handleDownloadScrambledPNG = () => {
    if (!scrambledBlob || !imageDetails) return;
    const url = URL.createObjectURL(scrambledBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shuffled_${imageDetails.file.name.replace(/\.[^/.]+$/, '')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Encryption execution
  const executeEncryption = async () => {
    if (!imageDetails || isEncrypting) return;
    setIsEncrypting(true);
    setErrorMessage(null);

    try {
      let result: EncryptionResult;

      if (selectedMethod === 'pixel-shuffle') {
        if (!scrambledBlob) {
          throw new Error('Please scramble the image before creating the container.');
        }
        result = await encryptPixelShuffleEVC(
          scrambledBlob,
          imageDetails.file.name,
          imageDetails.width,
          imageDetails.height,
          password,
          aesKeySize,
          (step) => setProgressStatus(step)
        );
      } else if (encryptionType === 'asymmetric') {
        if (!importedPublicKey) {
          throw new Error('Valid recipient RSA public key is required.');
        }
        result = await encryptImageRSA(
          imageDetails.file,
          importedPublicKey,
          rsaKeySize,
          (step) => setProgressStatus(step)
        );
      } else {
        result = await encryptImage(
          imageDetails.file,
          password,
          (step) => setProgressStatus(step),
          aesKeySize
        );
      }

      setEncryptionResult(result);
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Encryption failed.');
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleEncryptClick = () => {
    if (selectedMethod === 'standard' && encryptionType === 'symmetric') {
      if (isPasswordGenerated && !hasCopiedPassword) {
        setShowUncopiedWarningModal(true);
        return;
      }
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
    setEncryptionResult(null);
    setRecipientPublicKeyPEM('');
    setImportedPublicKey(null);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
      
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Encrypt <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Image</span>
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          Client-side visual security supporting Standard Encryption (AES-GCM / RSA Hybrid) and Pixel Shuffle Mode.
        </p>
      </div>

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 flex items-center space-x-3 text-sm animate-fadeIn">
          <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* METHOD SELECTION CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setSelectedMethod('standard')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            selectedMethod === 'standard'
              ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-950/30 ring-1 ring-blue-500'
              : 'glass-card border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selectedMethod === 'standard' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}>
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-base">Standard Image Encryption</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 font-semibold">
                  Default
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Symmetric AES (128/192/256) or Asymmetric RSA Hybrid (2048/3072/4096).
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMethod('pixel-shuffle')}
          className={`p-5 rounded-2xl border text-left transition-all ${
            selectedMethod === 'pixel-shuffle'
              ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/30 ring-1 ring-purple-500'
              : 'glass-card border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              selectedMethod === 'pixel-shuffle' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}>
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pixel Shuffle Mode</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Deterministic reversible pixel permutation with optional AES protection.
              </p>
            </div>
          </div>
        </button>
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
                onDragOver={(e) => e.preventDefault()}
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
                  <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-blue-500/30 bg-slate-900 flex-shrink-0 group">
                    <img
                      src={imageDetails.previewUrl}
                      alt="Selected preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start space-x-2">
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <h3 className="font-bold text-white truncate max-w-xs">{imageDetails.file.name}</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 max-w-sm">
                      <div>File Type: <span className="text-slate-200 font-semibold">{imageDetails.file.type || 'Unknown'}</span></div>
                      <div>File Size: <span className="text-slate-200 font-semibold">{formatBytes(imageDetails.file.size)}</span></div>
                      <div>Dimensions: <span className="text-slate-200 font-semibold">{imageDetails.width} × {imageDetails.height} px</span></div>
                      <div>Status: <span className="text-emerald-400 font-semibold">Image loaded</span></div>
                    </div>
                  </div>

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

          {/* STEP 02 — CONFIGURATION & KEYS */}
          {selectedMethod === 'standard' ? (
            /* STANDARD IMAGE ENCRYPTION SECTION */
            <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Encryption Parameters</h2>
                  <p className="text-xs text-slate-400">Choose between Symmetric AES or Asymmetric RSA Hybrid encryption.</p>
                </div>
              </div>

              {/* Encryption Type Selector (AES vs RSA) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Encryption Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEncryptionType('symmetric')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                      encryptionType === 'symmetric'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-900/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>Symmetric (AES)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEncryptionType('asymmetric')}
                    className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                      encryptionType === 'asymmetric'
                        ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-900/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-4 h-4" />
                    <span>Asymmetric (RSA Hybrid)</span>
                  </button>
                </div>
              </div>

              {/* Symmetric AES Mode Controls */}
              {encryptionType === 'symmetric' && (
                <div className="space-y-6 pt-2">
                  {/* AES Key Size Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      AES Key Size
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {([128, 192, 256] as AESKeySize[]).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setAesKeySize(size)}
                          className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                            aesKeySize === size
                              ? 'bg-blue-950/80 border-blue-500 text-blue-300 ring-1 ring-blue-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          AES-{size} {size === 256 && <span className="text-[10px] block text-emerald-400">(Default)</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Password Generator Button */}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-200" />
                      <span>Generate Secure Password</span>
                    </button>
                  </div>

                  {/* Generated Password Card */}
                  {isPasswordGenerated && (
                    <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                          Generated 24-char Key
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowGeneratedPassword(!showGeneratedPassword)}
                            className="text-xs text-slate-300 hover:text-white flex items-center space-x-1"
                          >
                            {showGeneratedPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{showGeneratedPassword ? 'Hide' : 'Show'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleGeneratePassword}
                            className="text-xs text-purple-300 hover:text-purple-200 flex items-center space-x-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Regenerate</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSwitchToManual}
                            className="text-xs text-slate-400 hover:text-slate-200 underline"
                          >
                            Manual
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-purple-500/30 font-mono text-sm tracking-wider text-purple-200 break-all select-all">
                          {showGeneratedPassword ? password : '•'.repeat(password.length || 24)}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all ${
                            copySuccess ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                        >
                          {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-300">
                        <span className="font-bold text-white">Guidance: </span>
                        Your password is generated securely. Save it safely and share it with the intended receiver through a separate trusted channel. Without the correct password, the encrypted image cannot be recovered.
                      </p>
                    </div>
                  )}

                  {/* Password Inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Secret Key
                      </label>
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
                          className="w-full px-4 py-2.5 rounded-xl glass-input pr-10 text-sm font-mono"
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

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Confirm Secret Key
                      </label>
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
                          className="w-full px-4 py-2.5 rounded-xl glass-input pr-10 text-sm font-mono"
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

                  {/* Password Strength */}
                  {password && (
                    <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-400">Password Strength:</span>
                        <span className={
                          strength.score === 'very-strong' ? 'text-cyan-400 font-extrabold' :
                          strength.score === 'strong' ? 'text-emerald-400 font-bold' :
                          strength.score === 'medium' ? 'text-amber-400 font-bold' : 'text-rose-400 font-bold'
                        }>
                          {strength.label}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            strength.score === 'very-strong' ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400' :
                            strength.score === 'strong' ? 'bg-emerald-500' :
                            strength.score === 'medium' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${strength.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Asymmetric RSA Mode Controls */}
              {encryptionType === 'asymmetric' && (
                <div className="space-y-6 pt-2">
                  {/* RSA Key Size Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      RSA Key Size
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {([2048, 3072, 4096] as RSAKeySize[]).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setRsaKeySize(size)}
                          className={`py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-all ${
                            rsaKeySize === size
                              ? 'bg-purple-950/80 border-purple-500 text-purple-300 ring-1 ring-purple-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          RSA-{size} {size === 2048 && <span className="text-[10px] block text-emerald-400">(Default)</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipient Public Key Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Recipient RSA Public Key (SPKI PEM)
                      </label>
                      <button
                        type="button"
                        onClick={() => publicKeyFileInputRef.current?.click()}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Upload .pem file
                      </button>
                      <input
                        type="file"
                        ref={publicKeyFileInputRef}
                        accept=".pem,.pub,.txt"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const text = await f.text();
                            setRecipientPublicKeyPEM(text);
                          }
                        }}
                      />
                    </div>
                    <textarea
                      rows={5}
                      value={recipientPublicKeyPEM}
                      onChange={(e) => setRecipientPublicKeyPEM(e.target.value)}
                      placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                      className="w-full p-3 rounded-xl glass-input text-xs font-mono"
                    />
                    {importedPublicKey && (
                      <div className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valid RSA Public Key loaded. Ready to encrypt.</span>
                      </div>
                    )}
                    {publicKeyError && (
                      <div className="flex items-center space-x-1.5 text-xs text-rose-400 font-semibold">
                        <AlertCircle className="w-4 h-4" />
                        <span>{publicKeyError}</span>
                      </div>
                    )}
                  </div>

                  {/* RSA Key Pair Generation Tool */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-white font-bold text-sm">
                        <Key className="w-4 h-4 text-purple-400" />
                        <span>Recipient Key Generator Tool</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleGenerateRSAKeys}
                        disabled={isGeneratingKeyPair}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {isGeneratingKeyPair ? 'Generating...' : `Generate RSA-${rsaKeySize} Key Pair`}
                      </button>
                    </div>

                    {keyGenSuccessNotice && (
                      <p className="text-xs text-emerald-400 font-semibold">{keyGenSuccessNotice}</p>
                    )}

                    {generatedKeyPairPEMs && (
                      <div className="space-y-4 pt-2 border-t border-slate-800/80">
                        {/* Public Key Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(generatedKeyPairPEMs.publicPEM);
                              setCopiedPublicSuccess(true);
                              setTimeout(() => setCopiedPublicSuccess(false), 2000);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:text-white flex items-center space-x-1.5"
                          >
                            {copiedPublicSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedPublicSuccess ? 'Copied Public Key!' : 'Copy Public Key'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadGeneratedPublicKey}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 hover:text-white flex items-center space-x-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Public Key (.pem)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecipientPublicKeyPEM(generatedKeyPairPEMs.publicPEM)}
                            className="px-3 py-1.5 rounded-lg bg-blue-900/60 border border-blue-700/60 text-xs text-blue-200 hover:text-white"
                          >
                            Use as Recipient Key
                          </button>
                        </div>

                        {/* Protected Private Key Export (Technical Correction 2) */}
                        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                          <span className="block text-xs font-bold text-amber-300">
                            🔒 Export Protected Private Key (Passphrase Required)
                          </span>
                          <p className="text-[11px] text-slate-400">
                            Private keys must be encrypted with a passphrase before export. Unprotected private keys are never stored or exported.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <input
                                type={showPrivPassphrase ? 'text' : 'password'}
                                value={privateKeyPassphrase}
                                onChange={(e) => setPrivateKeyPassphrase(e.target.value)}
                                placeholder="Enter passphrase (min 8 chars) to protect private key"
                                className="w-full px-3 py-2 rounded-lg glass-input text-xs font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPrivPassphrase(!showPrivPassphrase)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              >
                                {showPrivPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={handleDownloadProtectedPrivateKey}
                              className="px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold"
                            >
                              Download Protected Key (.pem)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          ) : (
            /* PIXEL SHUFFLE MODE SECTION */
            <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold text-sm">
                  02
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Pixel Shuffle Configuration</h2>
                  <p className="text-xs text-slate-400">Deterministic reversible permutation with exact bit recovery.</p>
                </div>
              </div>

              {/* Secret Key Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Permutation Secret Key
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-xs text-purple-400 hover:underline flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Key</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setIsPasswordGenerated(false);
                    }}
                    placeholder="Enter secret key to seed deterministic permutation"
                    className="w-full px-4 py-2.5 rounded-xl glass-input pr-10 text-sm font-mono"
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

              {/* Trigger Shuffle Button */}
              <button
                type="button"
                onClick={handleShufflePixels}
                disabled={!imageDetails || !password || isShuffling}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <Shuffle className="w-4 h-4" />
                <span>{isShuffling ? 'Permuting Pixels...' : 'Scramble Image Pixels'}</span>
              </button>

              {/* Scrambled vs Original Preview */}
              {scrambledImageUrl && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-center">
                      <span className="text-xs font-bold text-slate-400 uppercase">Original Preview</span>
                      <div className="h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                        <img src={imageDetails?.previewUrl} alt="Original" className="h-full object-contain mx-auto" />
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/40 space-y-2 text-center">
                      <span className="text-xs font-bold text-purple-300 uppercase">Scrambled Preview</span>
                      <div className="h-48 rounded-xl overflow-hidden bg-slate-900 border border-purple-900/50 flex items-center justify-center">
                        <img src={scrambledImageUrl} alt="Scrambled" className="h-full object-contain mx-auto" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleDownloadScrambledPNG}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 flex items-center space-x-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Scrambled PNG Only</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Transparency & Security Notice */}
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Important Security Clarification</span>
                </div>
                <p className="leading-relaxed">
                  Pixel shuffling alone is a visual permutation and NOT mathematical encryption. 
                  For secure transmission across public networks, enable AES-GCM container protection below so the receiver can decrypt and invert the permutation safely.
                </p>
                <div className="pt-2 flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="protectAES"
                    checked={protectShuffleWithAES}
                    onChange={(e) => setProtectShuffleWithAES(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                  />
                  <label htmlFor="protectAES" className="text-xs font-bold text-white cursor-pointer">
                    Protect with AES-GCM (Recommended for secure sharing)
                  </label>
                </div>
              </div>
            </section>
          )}

          {/* STEP 03 — ENCRYPT & DOWNLOAD TRIGGER */}
          <div className="pt-2">
            <button
              onClick={handleEncryptClick}
              disabled={!isFormValid || isEncrypting}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center space-x-3 ${
                !isFormValid || isEncrypting
                  ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-700/40'
                  : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white hover:shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {isEncrypting ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-white" />
                  <span>{progressStatus || 'Encrypting Payload...'}</span>
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  <span>
                    {selectedMethod === 'pixel-shuffle'
                      ? '🔒 Create Protected .EVC File'
                      : encryptionType === 'asymmetric'
                      ? `🔒 Encrypt with RSA-${rsaKeySize} Hybrid`
                      : `🔒 Encrypt with AES-${aesKeySize}-GCM`}
                  </span>
                </>
              )}
            </button>
          </div>

        </div>
      ) : (
        /* ENCRYPTION SUCCESS CARD */
        <div className="glass-card p-8 rounded-3xl space-y-8 border-emerald-500/30 shadow-emerald-950/20 animate-fadeIn">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white">✓ Image Encrypted Successfully</h2>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Your image has been encapsulated into an authenticated .EVC container.
            </p>
          </div>

          <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Method</span>
              <span className="text-white font-semibold">
                {selectedMethod === 'pixel-shuffle' ? 'Pixel Shuffle Mode' : 'Standard Image Encryption'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Algorithm</span>
              <span className="text-purple-300 font-semibold">
                {selectedMethod === 'pixel-shuffle'
                  ? `Pixel Shuffle + AES-${aesKeySize}-GCM`
                  : encryptionType === 'asymmetric'
                  ? `RSA-OAEP-${rsaKeySize} + AES-256-GCM`
                  : `AES-${aesKeySize}-GCM (Authenticated)`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Encrypted File</span>
              <span className="text-blue-400 font-semibold">{encryptionResult.evcFileName}</span>
            </div>
            <div>
              <span className="text-slate-500 text-xs block uppercase font-bold">Encrypted Size</span>
              <span className="text-white font-semibold">{formatBytes(encryptionResult.encryptedSize)}</span>
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
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-semibold text-sm flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Encrypt Another Image</span>
              </button>

              <button
                onClick={() => navigate('/decrypt')}
                className="flex-1 py-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 font-semibold text-sm flex items-center justify-center space-x-2"
              >
                <span>Go to Decrypt</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNCOPIED PASSWORD WARNING MODAL */}
      {showUncopiedWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card border border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">Save Your Generated Password</h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300">
              Your password is generated securely. Save it safely and share it with the intended receiver through a separate trusted channel. Without the correct password, the encrypted image cannot be recovered.
            </p>
            <div className="px-4 py-2.5 rounded-xl bg-slate-900 font-mono text-sm text-purple-300 break-all select-all">
              {password}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={async () => {
                  await handleCopyPassword();
                  setShowUncopiedWarningModal(false);
                  executeEncryption();
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-1.5"
              >
                <Copy className="w-4 h-4" />
                <span>Copy & Encrypt</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasCopiedPassword(true);
                  setShowUncopiedWarningModal(false);
                  executeEncryption();
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Proceed Without Copying
              </button>
              <button
                type="button"
                onClick={() => setShowUncopiedWarningModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-900 text-slate-400 text-xs"
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
