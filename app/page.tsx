'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, ShieldCheck, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="arbitrageDuka Logo" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold text-green-900 tracking-tight">arbitrageDuka</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hidden sm:block text-gray-600 hover:text-gray-900 font-medium transition-colors">
              Sign In
            </Link>
            <Link
              href="/dashboard"
              className="bg-green-900 hover:bg-green-800 text-white px-4 py-2 text-sm sm:px-5 sm:py-2.5 sm:text-base rounded-full font-bold transition-all transform hover:scale-105 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 lg:px-8 py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-800 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Zap size={16} className="fill-current" />
            <span>Start saving today</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold text-gray-900 tracking-tight leading-tight">
            Smarter shopping <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
              starts early
            </span>
          </h1>

          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Prices fall. You win.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full sm:w-auto">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto bg-green-900 hover:bg-green-800 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-bold text-base sm:text-lg transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-900/20"
            >
              Go to Dashboard
              <ArrowRight size={20} />
            </Link>
            <Link
              href="/offers"
              className="w-full sm:w-auto bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-bold text-base sm:text-lg transition-all flex items-center justify-center gap-2"
            >
              View Live Offers
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-7xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6">
              <TrendingUp className="text-green-700" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Price Tracking</h3>
            <p className="text-gray-500 leading-relaxed">
              Monitor prices 24/7. We'll notify you the moment your favorite items drop in price.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="text-blue-700" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Instant Alerts</h3>
            <p className="text-gray-500 leading-relaxed">
              Get real-time notifications for flash sales and limited-time offers before they run out.
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow text-left">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck className="text-purple-700" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Smart Analytics</h3>
            <p className="text-gray-500 leading-relaxed">
              Visualize price history and trends to know exactly when to buy for maximum profit.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">
              a
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">arbitrageDuka</span>
          </div>

          <div className="flex items-center gap-8 text-sm font-medium text-gray-500">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
            <a href="mailto:support@arbitrageduka.com" className="hover:text-gray-900 transition-colors">Contact</a>
          </div>

          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} arbitrageDuka. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
