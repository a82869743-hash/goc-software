import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Trash2, ArrowLeft } from 'lucide-react';

interface PublicLegalLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function PublicLegalLayout({ title, subtitle, children }: PublicLegalLayoutProps) {
  useEffect(() => {
    document.title = `${title} | GOC Studio`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="min-h-screen bg-[#0A0D14] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      {/* Header / Navbar */}
      <header className="relative z-10 sticky top-0 backdrop-blur-md bg-[#0A0D14]/80 border-b border-slate-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
              <span className="font-extrabold text-white text-lg tracking-wider">GOC</span>
            </div>
            <div>
              <span className="font-bold text-lg text-white block tracking-tight">God of Ceramic</span>
              <span className="text-xs text-indigo-400 font-medium">Studio Management System</span>
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to App
            </Link>
          </div>
        </div>
      </header>

      {/* Page Title Hero */}
      <section className="relative z-10 py-12 sm:py-16 bg-gradient-to-b from-indigo-950/20 to-transparent border-b border-slate-800/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
          <div className="mt-4 text-xs text-slate-500">
            Last Updated: August 1, 2026 • Domain: <span className="text-indigo-400">godofceramic.cloud</span>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 sm:p-10 shadow-2xl shadow-black/50 space-y-10 leading-relaxed text-slate-300 text-sm sm:text-base">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#070A0F] py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <span className="font-bold text-white tracking-wide">God of Ceramic (GOC Studio)</span>
            <p className="text-xs text-slate-500 mt-1">
              Automotive Ceramic Coating & Detailing Management Platform
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              © {new Date().getFullYear()} GOC Studio. All rights reserved.
            </p>
          </div>

          <nav className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              to="/privacy-policy"
              className="inline-flex items-center text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Shield className="w-4 h-4 mr-1.5" />
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="inline-flex items-center text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Terms & Conditions
            </Link>
            <Link
              to="/data-deletion"
              className="inline-flex items-center text-slate-400 hover:text-indigo-400 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Data Deletion Instructions
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
