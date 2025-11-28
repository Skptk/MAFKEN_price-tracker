'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Sparkles, RefreshCw, AlertTriangle, Search } from 'lucide-react';

import { TrackedItem } from '@/lib/types';
import { extractSKUFromLink } from '@/lib/utils';

export default function OffersPage() {
    const [discoveredOffers, setDiscoveredOffers] = useState<any[]>([]);
    const [offersLoading, setOffersLoading] = useState(false);
    const [lastOffersFetch, setLastOffersFetch] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
    const [trackedSkus, setTrackedSkus] = useState<Set<string>>(new Set());
    const [trackingSkus, setTrackingSkus] = useState<Set<string>>(new Set());

    useEffect(() => {
        // Load tracked items to check status
        const storedItems = localStorage.getItem('price-tracker-items');
        if (storedItems) {
            try {
                const items: TrackedItem[] = JSON.parse(storedItems);
                const skus = new Set(items.filter(i => i.status !== 'deleted').map(i => i.sku));
                setTrackedSkus(skus);
            } catch (e) {
                console.error('Failed to load tracked items');
            }
        }

        // Load offers from cache on mount
        const storedOffers = localStorage.getItem('discoveredOffers');
        const storedOffersFetch = localStorage.getItem('lastOffersFetch');
        if (storedOffers && storedOffersFetch) {
            try {
                setDiscoveredOffers(JSON.parse(storedOffers));
                setLastOffersFetch(storedOffersFetch);
            } catch (e) {
                console.error('Failed to load offers');
            }
        } else {
            // Initial fetch if no cache
            fetchOffers();
        }
    }, []);

    const handleTrackProduct = async (offer: any) => {
        const sku = offer.sku || extractSKUFromLink(offer.url);
        if (!sku) {
            setToast({ message: 'Could not extract SKU', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        if (trackedSkus.has(sku)) {
            setToast({ message: 'Item is already being tracked', type: 'info' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        // Set loading state for this specific item
        setTrackingSkus(prev => new Set(prev).add(sku));
        setToast({ message: `Adding ${offer.name}...`, type: 'info' });

        try {
            // Call scrape API to get fresh, accurate data
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: offer.url, sku })
            });

            const data = await response.json();

            if (!data.success || !data.price) {
                throw new Error(data.error || 'Could not extract price');
            }

            const storedItems = localStorage.getItem('price-tracker-items');
            const currentItems: TrackedItem[] = storedItems ? JSON.parse(storedItems) : [];

            const newItem: TrackedItem = {
                id: Date.now().toString(),
                sku: data.sku,
                name: data.name || offer.name,
                link: offer.url,
                retailPrice: data.price,
                originalPrice: data.originalPrice,
                currentPrice: data.price,
                imageUrl: data.imageUrl || offer.imageUrl,
                priceHistory: [{ price: data.price, date: new Date().toLocaleString() }],
                lastUpdated: new Date().toISOString(),
                alertTriggered: false,
                status: 'active',
                dateAdded: new Date().toISOString(),
            };

            const updatedItems = [...currentItems, newItem];
            localStorage.setItem('price-tracker-items', JSON.stringify(updatedItems));

            // Update local state
            setTrackedSkus(prev => new Set(prev).add(sku));

            setToast({ message: `✓ Now tracking ${data.name || offer.name}`, type: 'success' });
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            console.error('Failed to add item', error);
            setToast({
                message: `✗ ${error instanceof Error ? error.message : 'Failed to add item'}`,
                type: 'error'
            });
            setTimeout(() => setToast(null), 3000);
        } finally {
            // Remove loading state
            setTrackingSkus(prev => {
                const next = new Set(prev);
                next.delete(sku);
                return next;
            });
        }
    };

    const fetchOffers = async () => {
        // Check cache validity (1 hour)
        if (lastOffersFetch) {
            const timeSinceLastFetch = Date.now() - new Date(lastOffersFetch).getTime();
            const oneHour = 1 * 60 * 60 * 1000;

            if (timeSinceLastFetch < oneHour && discoveredOffers.length > 0 && !offersLoading) {
                setToast({
                    message: 'Using cached offers (refreshes every hour)',
                    type: 'info'
                });
                setTimeout(() => setToast(null), 3000);
                return;
            }
        }

        setOffersLoading(true);
        try {
            const response = await fetch('/api/discover-offers', {
                method: 'POST',
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch offers');
            }

            if (data.offers.length === 0) {
                setToast({
                    message: 'No offers found at the moment',
                    type: 'info'
                });
                setTimeout(() => setToast(null), 3000);
                return;
            }

            const timestamp = new Date().toISOString();
            setDiscoveredOffers(data.offers);
            setLastOffersFetch(timestamp);

            // Cache in localStorage
            localStorage.setItem('discoveredOffers', JSON.stringify(data.offers));
            localStorage.setItem('lastOffersFetch', timestamp);

            setToast({
                message: `Found ${data.offers.length} offers!`,
                type: 'success'
            });
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            setToast({
                message: error instanceof Error ? error.message : 'Failed to fetch offers',
                type: 'error'
            });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setOffersLoading(false);
        }
    };

    const filteredOffers = discoveredOffers.filter(offer =>
        offer.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-[#f3f4f6] font-sans">
            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
                    <div className={`px-6 py-3 rounded-full shadow-lg border flex items-center gap-2 ${toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-900' :
                        toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
                            'bg-green-50 border-green-200 text-green-900'
                        }`}>
                        <AlertTriangle size={16} />
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto p-4 sm:p-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-2 transition-colors">
                            <ArrowLeft size={20} />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-bold text-gray-900">Available Offers</h1>
                        <p className="text-gray-500 mt-1">
                            Discover the latest deals and discounts from Carrefour Kenya.
                            {lastOffersFetch && <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">Updated: {new Date(lastOffersFetch).toLocaleDateString()}</span>}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search offers..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={() => {
                                localStorage.removeItem('lastOffersFetch');
                                setLastOffersFetch(null);
                                fetchOffers();
                            }}
                            disabled={offersLoading}
                            className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw size={18} className={offersLoading ? 'animate-spin' : ''} />
                            <span className="hidden sm:inline">Refresh Offers</span>
                        </button>
                    </div>
                </div>

                {/* Offers Grid */}
                {offersLoading && discoveredOffers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Sparkles className="w-12 h-12 text-amber-500 animate-pulse mb-4" />
                        <p className="text-gray-500 font-medium">Finding the best deals for you...</p>
                    </div>
                ) : filteredOffers.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-gray-100">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="text-gray-400" size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">No offers found</h3>
                        <p className="text-gray-500 max-w-md mx-auto">
                            {searchQuery ? `No results for "${searchQuery}"` : "We couldn't find any offers right now. Try refreshing."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredOffers.map((offer, index) => {
                            const sku = offer.sku || extractSKUFromLink(offer.url);
                            const isTracked = sku && trackedSkus.has(sku);
                            const isTracking = sku && trackingSkus.has(sku);

                            return (
                                <div
                                    key={index}
                                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] flex flex-col group"
                                >
                                    {offer.imageUrl && (
                                        <div className="w-full aspect-square bg-gray-50 rounded-xl mb-4 overflow-hidden relative">
                                            <img
                                                src={offer.imageUrl}
                                                alt={offer.name}
                                                className="w-full h-full object-contain mix-blend-multiply p-4"
                                            />
                                            {offer.discount && (
                                                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                                    {offer.discount}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex-1 flex flex-col">
                                        <h3 className="font-bold text-gray-900 text-sm mb-2 line-clamp-2 group-hover:text-amber-600 transition-colors">
                                            {offer.name}
                                        </h3>

                                        <div className="mt-auto">
                                            <div className="mb-4">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xl font-bold text-gray-900">
                                                        KES {offer.price.toLocaleString()}
                                                    </span>
                                                    {offer.originalPrice && offer.originalPrice > offer.price && (
                                                        <span className="text-sm text-gray-400 line-through">
                                                            KES {offer.originalPrice.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                {offer.originalPrice && offer.originalPrice > offer.price && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                                            Save KES {(offer.originalPrice - offer.price).toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleTrackProduct(offer)}
                                                    disabled={isTracked || isTracking}
                                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isTracked
                                                        ? 'bg-green-100 text-green-800 cursor-default'
                                                        : isTracking
                                                            ? 'bg-blue-100 text-blue-800 cursor-wait'
                                                            : 'bg-[#064e3b] hover:bg-[#065f46] text-white'
                                                        }`}
                                                >
                                                    {isTracked ? '✓ Tracked' : isTracking ? 'Adding...' : 'Track This'}
                                                </button>
                                                <a
                                                    href={offer.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2.5 rounded-xl transition-colors"
                                                >
                                                    <ExternalLink size={18} />
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-20 border-t border-gray-200 pt-8 pb-12">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                                A
                            </div>
                            <span className="font-bold text-xl tracking-tight text-gray-900">aggregateDuka</span>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                            <Link href="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
                            <span>© {new Date().getFullYear()} arbitrageDuka</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
