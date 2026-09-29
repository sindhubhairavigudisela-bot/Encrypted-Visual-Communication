import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Unlock,
  ShieldCheck,
  Cpu,
  KeyRound,
  EyeOff,
  ArrowRight,
  FileImage,
  Share2,
  FileLock2,
  CheckCircle2,
  Zap,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  const workflowSteps = [
    { title: 'IMAGE', desc: 'Select raw image', icon: FileImage, color: 'from-blue-500 to-cyan-500' },
    { title: 'ENCRYPT', desc: 'AES-GCM 256-bit', icon: Lock, color: 'from-blue-600 to-indigo-600' },
    { title: '.EVC', desc: 'Secure container', icon: FileLock2, color: 'from-indigo-600 to-purple-600' },
    { title: 'SHARE', desc: 'Untrusted channel', icon: Share2, color: 'from-purple-600 to-pink-600' },
    { title: 'SECRET KEY', desc: 'Recipients password', icon: KeyRound, color: 'from-purple-500 to-amber-500' },
    { title: 'DECRYPT', desc: 'Authenticate & decode', icon: Unlock, color: 'from-emerald-600 to-teal-600' },
    { title: 'IMAGE', desc: 'Recovered visual', icon: CheckCircle2, color: 'from-teal-500 to-emerald-400' },
  ];

  const features = [
    {
      icon: Cpu,
      title: 'Client-Side Processing',
      description: 'Images are processed locally in the browser. Zero bytes are ever sent to an external server or remote network.',
      accent: 'border-blue-500/30 text-blue-400',
    },
    {
      icon: ShieldCheck,
      title: 'AES-GCM Encryption',
      description: 'Use authenticated encryption with 256-bit Galois/Counter Mode. Ensures privacy and detects file tampering.',
      accent: 'border-purple-500/30 text-purple-400',
    },
    {
      icon: KeyRound,
      title: 'Password-Based Key',
      description: 'Derive the encryption key from the user\'s secret key using PBKDF2 with SHA-256 and 100,000 hashing iterations.',
      accent: 'border-indigo-500/30 text-indigo-400',
    },
    {
      icon: EyeOff,
      title: 'No Password Storage',
      description: 'The application must never store the user\'s password or key in memory, localStorage, cookies, or remote databases.',
      accent: 'border-cyan-500/30 text-cyan-400',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-5rem)] py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
      
      {/* Hero Section */}
      <section className="relative text-center space-y-8 pt-8 pb-4">
        {/* Glow ambient background sphere */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-tr from-blue-600/20 to-purple-600/20 blur-3xl rounded-full pointer-events-none -z-10" />

        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full glass-card border border-blue-500/30 text-xs font-semibold text-blue-300">
          <Zap className="w-4 h-4 text-blue-400" />
          <span>Client-Side Cryptography • Zero-Knowledge Architecture</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Secure Your <br />
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent text-glow-blue">
            Visual Communication
          </span>
        </h1>

        <p className="text-xl sm:text-2xl font-medium text-slate-300 max-w-3xl mx-auto">
          Encrypt your images before they leave your device.
        </p>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          EVC protects visual information by encrypting images locally in your browser before they are shared. 
          Only someone with the correct secret key can recover the original image.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={() => navigate('/encrypt')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-lg shadow-xl shadow-blue-600/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-3 group"
          >
            <Lock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span>🔒 Encrypt Image</span>
          </button>

          <button
            onClick={() => navigate('/decrypt')}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 text-white font-bold text-lg border border-purple-500/40 hover:border-purple-400/80 shadow-xl shadow-purple-950/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-3 group"
          >
            <Unlock className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
            <span>🔓 Decrypt Image</span>
          </button>
        </div>
      </section>

      {/* Visual Workflow Section */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Visual Cryptographic Workflow</h2>
          <p className="text-slate-400 text-sm">End-to-end local encryption lifecycle</p>
        </div>

        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-blue-900/40">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-center">
            {workflowSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <React.Fragment key={idx}>
                  <div className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:border-blue-500/40 transition-all">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${step.color} p-0.5 shadow-lg mb-2 flex items-center justify-center text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="font-extrabold text-xs tracking-wider text-slate-200">{step.title}</span>
                    <span className="text-[11px] text-slate-400 mt-1">{step.desc}</span>
                  </div>

                  {idx < workflowSteps.length - 1 && (
                    <div className="hidden md:flex justify-center items-center text-slate-600">
                      <ArrowRight className="w-5 h-5 animate-pulse text-blue-500" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* Home Features Cards */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Core Security Guarantees</h2>
          <p className="text-slate-400 text-sm">Designed for confidential visual communication</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="glass-card glass-card-hover p-6 rounded-2xl border flex flex-col space-y-4"
              >
                <div className={`w-12 h-12 rounded-xl bg-slate-900 border ${feat.accent} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">{feat.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};
