import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { EncryptPage } from './pages/EncryptPage';
import { DecryptPage } from './pages/DecryptPage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { AboutPage } from './pages/AboutPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
        {/* Global Navigation Bar */}
        <Navbar />

        {/* Main Content Body */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/encrypt" element={<EncryptPage />} />
            <Route path="/decrypt" element={<DecryptPage />} />
            <Route path="/how-it-works" element={<HowItWorksPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>

        {/* Global Footer */}
        <footer className="border-t border-slate-900 bg-[#080b13] py-8 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-400">EVC — Encrypted Visual Communication</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Client-Side Zero-Knowledge Cryptography</p>
            </div>
            <div className="flex items-center space-x-4 text-slate-400">
              <span className="hover:text-white transition-colors">AES-GCM 256-bit</span>
              <span>•</span>
              <span className="hover:text-white transition-colors">PBKDF2 SHA-256</span>
              <span>•</span>
              <span className="hover:text-white transition-colors">Web Crypto API</span>
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
