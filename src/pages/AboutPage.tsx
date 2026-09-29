import React from 'react';
import { Shield, AlertTriangle, Code2, Lock, Eye, CheckCircle2 } from 'lucide-react';

export const AboutPage: React.FC = () => {
  const techStack = [
    { name: 'React 19', desc: 'Modern reactive component UI library' },
    { name: 'TypeScript', desc: 'Strict type safety and robust data structures' },
    { name: 'Web Crypto API', desc: 'Native browser cryptographic hardware acceleration' },
    { name: 'AES-GCM (256-bit)', desc: 'Galois/Counter Mode authenticated encryption' },
    { name: 'PBKDF2 (SHA-256)', desc: '100,000 iteration password key derivation' },
  ];

  return (
    <div className="min-h-[calc(100vh-5rem)] py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-12">
      
      {/* Page Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          About <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">EVC</span>
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
          Encrypted Visual Communication provides robust zero-knowledge client-side visual confidentiality.
        </p>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Section 1: Problem */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-4 border-rose-500/20">
          <div className="flex items-center space-x-3 text-rose-400">
            <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">The Problem</h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            Traditional image sharing can expose sensitive visual information if the communication channel or recipient environment is compromised. 
            Standard image formats (JPG, PNG, WEBP) display raw visual pixels directly upon opening, making them vulnerable to interception, cloud indexing, and unauthorized screen previews.
          </p>
        </div>

        {/* Section 2: Proposed Solution */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-4 border-emerald-500/20">
          <div className="flex items-center space-x-3 text-emerald-400">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Proposed Solution</h2>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            EVC encrypts the image before sharing so the shared file does not directly contain a viewable image. 
            By converting raw visual files into an authenticated <code className="text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">.EVC</code> container, 
            only recipients possessing the correct pre-shared secret key can restore and view the underlying image.
          </p>
        </div>

      </div>

      {/* Technologies Used */}
      <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex items-center space-x-3 text-blue-400">
          <div className="w-10 h-10 rounded-xl bg-blue-950 border border-blue-500/30 flex items-center justify-center">
            <Code2 className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white">Technologies & Cryptography</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {techStack.map((tech, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-white font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span>{tech.name}</span>
              </div>
              <p className="text-xs text-slate-400 pl-6">{tech.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy Guarantees */}
      <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-4 border-purple-500/20">
        <div className="flex items-center space-x-3 text-purple-400">
          <div className="w-10 h-10 rounded-xl bg-purple-950 border border-purple-500/30 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white">Privacy Architecture</h2>
        </div>
        <p className="text-slate-300 text-sm leading-relaxed">
          Images are processed locally in the browser using W3C standard Web Crypto primitives (<code className="text-purple-300 bg-slate-900 px-1.5 py-0.5 rounded font-mono">window.crypto.subtle</code>). 
          Neither the plaintext image, secret passphrase, nor derived AES encryption key is ever transmitted over network sockets or saved to disk unencrypted.
        </p>
      </section>

      {/* Honest Limitations */}
      <section className="glass-card p-6 sm:p-8 rounded-3xl space-y-4 border-amber-500/20 bg-slate-950/50">
        <div className="flex items-center space-x-3 text-amber-400">
          <div className="w-10 h-10 rounded-xl bg-amber-950 border border-amber-500/30 flex items-center justify-center">
            <Eye className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white">Responsible Security & Limitations</h2>
        </div>
        <div className="text-slate-300 text-sm leading-relaxed space-y-3">
          <p>
            EVC relies on strong mathematical principles (AES-GCM-256 + PBKDF2), but security ultimately depends on user operational security:
          </p>
          <ul className="list-disc list-inside space-y-2 text-slate-400 text-xs">
            <li>
              <strong className="text-slate-200">Key Distribution:</strong> If the secret key is shared over an insecure or monitored communication channel, unauthorized parties could decrypt the file.
            </li>
            <li>
              <strong className="text-slate-200">Passphrase Entropy:</strong> Weak passphrases remain vulnerable to offline brute-force attacks if an attacker intercepts the .EVC container file.
            </li>
            <li>
              <strong className="text-slate-200">Endpoint Security:</strong> Screen recording tools or malware active on the user's host OS can capture visual data after decryption.
            </li>
          </ul>
        </div>
      </section>

    </div>
  );
};
