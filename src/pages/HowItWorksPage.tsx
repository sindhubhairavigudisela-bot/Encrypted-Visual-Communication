import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  FileImage,
  Key,
  Cpu,
  Lock,
  FileLock2,
  Share2,
  Unlock,
  CheckCircle2,
} from 'lucide-react';

interface StepItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  details: string[];
  cryptoInfo: string;
}

export const HowItWorksPage: React.FC = () => {
  const [openStep, setOpenStep] = useState<string | null>('01');

  const steps: StepItem[] = [
    {
      id: '01',
      number: '01',
      title: 'Select Image',
      subtitle: 'Local File Ingestion',
      icon: FileImage,
      summary: 'The user selects an image file (JPG, PNG, WEBP) from their device.',
      details: [
        'The image is loaded into browser memory using HTML5 FileReader / ArrayBuffer.',
        'File type, size, and original pixel dimensions are inspected.',
        'No network connection is opened; the image stays strictly within client memory.',
      ],
      cryptoInfo: 'ArrayBuffer conversion via Blob API. Maximum size capped at 20MB for browser memory efficiency.',
    },
    {
      id: '02',
      number: '02',
      title: 'Enter Secret Key',
      subtitle: 'Passphrase Input & Validation',
      icon: Key,
      summary: 'The sender creates a secret passphrase to secure the visual file.',
      details: [
        'Passphrase complexity is evaluated dynamically (length, character variety).',
        'Min length of 8 characters enforced.',
        'The password is kept in transient component state only and never stored in localStorage, cookies, or remote logs.',
      ],
      cryptoInfo: 'UTF-8 string encoding via TextEncoder. Zero persistence policy.',
    },
    {
      id: '03',
      number: '03',
      title: 'Derive Encryption Key',
      subtitle: 'PBKDF2 Key Derivation Function',
      icon: Cpu,
      summary: 'A cryptographically strong 256-bit AES key is derived from the user passphrase.',
      details: [
        'A 16-byte (128-bit) cryptographically random salt is generated using window.crypto.getRandomValues().',
        'PBKDF2 (Password-Based Key Derivation Function 2) runs 100,000 hashing iterations using HMAC-SHA-256.',
        'Prevents dictionary and pre-computed rainbow table attacks.',
      ],
      cryptoInfo: 'window.crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" })',
    },
    {
      id: '04',
      number: '04',
      title: 'AES-GCM Encryption',
      subtitle: 'Authenticated Galois/Counter Mode Encryption',
      icon: Lock,
      summary: 'The image binary data is encrypted with AES-256 in GCM mode.',
      details: [
        'A unique 12-byte (96-bit) Initialization Vector (IV/nonce) is generated.',
        'AES-GCM encrypts the image bytes and appends a 128-bit authentication tag.',
        'The auth tag guarantees payload integrity and detects any file tampering or corruption.',
      ],
      cryptoInfo: 'window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, derivedKey, plaintextBuffer)',
    },
    {
      id: '05',
      number: '05',
      title: 'Create .EVC Container',
      subtitle: 'Structured Binary Packaging',
      icon: FileLock2,
      summary: 'The ciphertext, salt, IV, and metadata are combined into a single downloadable .evc file.',
      details: [
        'Header Magic Bytes "EVC1" (0x45 0x56 0x43 0x31) identify the custom container format.',
        'Original filename, MIME type, salt, and IV are embedded in the container header.',
        'The secret passphrase and derived encryption key are explicitly excluded.',
      ],
      cryptoInfo: 'Binary DataView layout: [EVC1 Header | Salt Len | Salt | IV Len | IV | Meta Len | Metadata JSON | Ciphertext]',
    },
    {
      id: '06',
      number: '06',
      title: 'Share Encrypted File',
      subtitle: 'Untrusted Channel Transport',
      icon: Share2,
      summary: 'The sender transmits the .evc file across any public or untrusted channel.',
      details: [
        'Email, messaging apps, cloud drives, or USB media can safely transmit the .evc container.',
        'Without the secret passphrase, interceptors see only high-entropy random ciphertext.',
        'Visual payload remains mathematically unreadable.',
      ],
      cryptoInfo: 'High-entropy ciphertext indistinguishable from random noise.',
    },
    {
      id: '07',
      number: '07',
      title: 'Enter Secret Key (Receiver)',
      subtitle: 'Recipient Authentication',
      icon: Unlock,
      summary: 'The receiver uploads the .evc file and enters the pre-shared secret key.',
      details: [
        'The application parses the .evc container header to extract salt and IV.',
        'PBKDF2 regenerates the exact 256-bit AES key using the entered passphrase and extracted salt.',
        'The browser prepares AES-GCM authenticated decryption.',
      ],
      cryptoInfo: 'Extracts 16-byte salt and 12-byte IV directly from .EVC header offset.',
    },
    {
      id: '08',
      number: '08',
      title: 'Recover Original Image',
      subtitle: 'Authenticated Decryption & Rendering',
      icon: CheckCircle2,
      summary: 'AES-GCM decrypts the payload and verifies the authentication tag.',
      details: [
        'If the key is correct, AES-GCM returns the exact original image ArrayBuffer.',
        'An in-memory Blob URL renders the recovered image cleanly in the UI.',
        'If the key is wrong or file modified, authentication fails immediately with zero data leak.',
      ],
      cryptoInfo: 'window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, derivedKey, ciphertext)',
    },
  ];

  const toggleStep = (id: string) => {
    setOpenStep(openStep === id ? null : id);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-10">
      
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          How It <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">Works</span>
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          An interactive step-by-step breakdown of the zero-knowledge browser cryptography engine powering EVC.
        </p>
      </div>

      {/* 8 Expandable Step Cards */}
      <div className="space-y-4">
        {steps.map((step) => {
          const Icon = step.icon;
          const isOpen = openStep === step.id;

          return (
            <div
              key={step.id}
              className={`glass-card rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen ? 'border-blue-500/40 bg-slate-900/80 shadow-lg shadow-blue-950/30' : 'border-slate-800/80 hover:border-slate-700/80'
              }`}
            >
              {/* Clickable Card Header */}
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full p-5 sm:p-6 flex items-center justify-between text-left focus:outline-none"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold transition-colors ${
                    isOpen
                      ? 'bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-md'
                      : 'bg-slate-950 border border-slate-800 text-slate-400'
                  }`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Step {step.number}</span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400 font-medium">{step.subtitle}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-0.5">{step.title}</h3>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 text-slate-400 border border-slate-800">
                  {isOpen ? <ChevronUp className="w-5 h-5 text-blue-400" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </button>

              {/* Expandable Body Content */}
              {isOpen && (
                <div className="px-5 pb-6 sm:px-6 space-y-4 border-t border-slate-800/60 pt-4 animate-fadeIn">
                  <p className="text-slate-300 font-medium text-sm leading-relaxed">
                    {step.summary}
                  </p>

                  <div className="space-y-2 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wider block">Key Operations:</span>
                    <ul className="space-y-1.5 list-disc list-inside text-slate-300">
                      {step.details.map((d, idx) => (
                        <li key={idx} className="leading-relaxed">{d}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs font-mono text-blue-300 flex items-start space-x-2">
                    <span className="font-bold uppercase text-blue-400 font-sans">Web Crypto API:</span>
                    <span className="break-all">{step.cryptoInfo}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
