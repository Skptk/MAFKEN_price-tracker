'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Plus, Menu, X, Trash2, ExternalLink, RefreshCw, TrendingDown, TrendingUp, Clock, AlertTriangle, Check, ChevronRight, LayoutDashboard, Package, Sparkles } from 'lucide-react';
import SavingsChart from '../components/SavingsChart';
import ProductHistoryChart from '../components/ProductHistoryChart';
import { TrackedItem, AlertMessage, Project } from '@/lib/types';
import { extractSKUFromLink, extractProductName, isBelowThreshold, pricePercentage } from '@/lib/utils';

// Rate limiting: Check items max once per 15 minutes
const MIN_CHECK_INTERVAL = 15 * 60 * 1000;
// Background polling: Check all items every 30 minutes
const BACKGROUND_POLL_INTERVAL = 30 * 60 * 1000;

// Unique ID generator for alerts (prevents duplicate keys)
let idCounter = 0;
const generateUniqueId = () => {
    return `${Date.now()}-${idCounter++}`;
};

export default function PriceTracker() {
    const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([]);
    const [productLink, setProductLink] = useState('');
    const [alerts, setAlerts] = useState<AlertMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [backgroundChecking, setBackgroundChecking] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<TrackedItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [deletedItemsCount, setDeletedItemsCount] = useState(0);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetSavings, setTargetSavings] = useState<number | null>(null);
    const [targetInput, setTargetInput] = useState('');
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
    const [selectedDeletedItems, setSelectedDeletedItems] = useState<Set<string>>(new Set());
    const [discoveredOffers, setDiscoveredOffers] = useState<any[]>([]);
    const [offersLoading, setOffersLoading] = useState(false);
    const [lastOffersFetch, setLastOffersFetch] = useState<string | null>(null);

    // Load target savings from local storage
    useEffect(() => {
        const savedTarget = localStorage.getItem('targetSavings');
        if (savedTarget) {
            setTargetSavings(Number(savedTarget));
        }
    }, []);

    // Save target savings to local storage
    useEffect(() => {
        if (targetSavings !== null) {
            localStorage.setItem('targetSavings', targetSavings.toString());
        }
    }, [targetSavings]);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectCategory, setNewProjectCategory] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [currentView, setCurrentView] = useState<'dashboard' | 'history' | 'help'>('dashboard');
    const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('price-tracker-items');
        if (stored) {
            try {
                setTrackedItems(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to load stored items');
            }
        }
        const storedProjects = localStorage.getItem('price-tracker-projects');
        if (storedProjects) {
            try {
                setProjects(JSON.parse(storedProjects));
            } catch (e) {
                console.error('Failed to load projects');
            }
        }
        const storedDeleted = localStorage.getItem('price-tracker-deleted-count');
        if (storedDeleted) {
            setDeletedItemsCount(parseInt(storedDeleted) || 0);
        }

        // Load discovered offers from cache
        const storedOffers = localStorage.getItem('discoveredOffers');
        const storedOffersFetch = localStorage.getItem('lastOffersFetch');
        if (storedOffers && storedOffersFetch) {
            try {
                const offers = JSON.parse(storedOffers);
                setDiscoveredOffers(offers);
                setLastOffersFetch(storedOffersFetch);
            } catch (e) {
                console.error('Failed to load offers');
            }
        }
    }, []);

    useEffect(() => {
        if (trackedItems.length > 0) {
            localStorage.setItem('price-tracker-items', JSON.stringify(trackedItems));
        }
    }, [trackedItems]);

    useEffect(() => {
        localStorage.setItem('price-tracker-projects', JSON.stringify(projects));
    }, [projects]);

    useEffect(() => {
        localStorage.setItem('price-tracker-deleted-count', deletedItemsCount.toString());
    }, [deletedItemsCount]);

    const getRelativeTime = (timestamp: string | null): string => {
        if (!timestamp) return 'Never';
        const now = new Date();
        const then = new Date(timestamp);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    const shouldCheckItem = (item: TrackedItem): boolean => {
        // Don't check deleted items
        if (item.status === 'deleted') return false;
        if (!item.lastUpdated) return true;
        const lastCheck = new Date(item.lastUpdated).getTime();
        return Date.now() - lastCheck >= MIN_CHECK_INTERVAL;
    };

    const checkAllPrices = async () => {
        // Only check active (non-deleted) items
        const itemsToCheck = trackedItems.filter(item => item.status !== 'deleted' && shouldCheckItem(item));
        if (itemsToCheck.length === 0) return;
        setBackgroundChecking(true);
        for (const item of itemsToCheck) {
            await checkPrice(item, true);
            // 3-5 second delay between items to avoid overwhelming server
            await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 2000));
        }
        setBackgroundChecking(false);
    };

    useEffect(() => {
        if (trackedItems.length === 0) {
            if (backgroundTimerRef.current) {
                clearInterval(backgroundTimerRef.current);
                backgroundTimerRef.current = null;
            }
            return;
        }
        const initialTimeout = setTimeout(() => checkAllPrices(), 30000);
        backgroundTimerRef.current = setInterval(() => checkAllPrices(), BACKGROUND_POLL_INTERVAL);
        return () => {
            clearTimeout(initialTimeout);
            if (backgroundTimerRef.current) clearInterval(backgroundTimerRef.current);
        };
    }, [trackedItems.length]);

    // Auto-refresh missing image when detail modal is open
    useEffect(() => {
        if (showDetailModal && selectedProduct && !selectedProduct.imageUrl && !loading) {
            checkPrice(selectedProduct);
        }
    }, [showDetailModal, selectedProduct?.id]);

    // Sync selectedProduct with trackedItems to ensure updates (like new images) are reflected immediately
    useEffect(() => {
        if (selectedProduct) {
            const updatedItem = trackedItems.find(i => i.id === selectedProduct.id);
            if (updatedItem && updatedItem !== selectedProduct) {
                setSelectedProduct(updatedItem);
            }
        }
    }, [trackedItems]);

    const scrapeAndAddProduct = async () => {
        if (!productLink.trim()) {
            alert('Please enter a product link');
            return;
        }
        const sku = extractSKUFromLink(productLink);
        if (!sku) {
            alert('Could not extract SKU');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: productLink, sku })
            });
            const data = await response.json();
            if (!data.success || !data.price) {
                throw new Error(data.error || 'Could not extract price');
            }
            const newItem: TrackedItem = {
                id: Date.now().toString(),
                sku: data.sku,
                name: data.name || extractProductName(productLink),
                link: productLink,
                retailPrice: data.price,
                originalPrice: data.originalPrice,
                currentPrice: data.price,
                imageUrl: data.imageUrl,
                priceHistory: [{ price: data.price, date: new Date().toLocaleString() }],
                lastUpdated: new Date().toISOString(),
                alertTriggered: false,
                projectId: selectedProjectId || undefined,
                status: 'active',
                dateAdded: new Date().toISOString(),
            };
            setTrackedItems([...trackedItems, newItem]);
            setProductLink('');
            setShowAddModal(false);
            const successAlert: AlertMessage = {
                id: generateUniqueId(),
                sku: data.sku,
                name: data.name,
                message: `✓ Added ${data.name}`,
                time: new Date().toLocaleTimeString(),
                type: 'success',
            };
            setAlerts(prev => [successAlert, ...prev.slice(0, 4)]);
        } catch (error) {
            const errorAlert: AlertMessage = {
                id: generateUniqueId(),
                sku: '',
                name: 'Error',
                message: `✗ ${error instanceof Error ? error.message : 'Failed'}`,
                time: new Date().toLocaleTimeString(),
                type: 'error',
            };
            setAlerts(prev => [errorAlert, ...prev.slice(0, 4)]);
        } finally {
            setLoading(false);
        }
    };

    const checkPrice = async (item: TrackedItem, isBackground = false) => {
        // Check cooldown for manual checks (5 minutes)
        if (!isBackground && item.lastManualCheck) {
            const lastCheck = new Date(item.lastManualCheck).getTime();
            const cooldownMs = 5 * 60 * 1000; // 5 minutes
            const timeSinceLastCheck = Date.now() - lastCheck;

            if (timeSinceLastCheck < cooldownMs) {
                const minutesLeft = Math.ceil((cooldownMs - timeSinceLastCheck) / 60000);
                setToast({
                    message: `Please wait ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} before checking again`,
                    type: 'info'
                });
                setTimeout(() => setToast(null), 3000);
                return;
            }
        }

        if (!isBackground) setLoading(true);
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.link, sku: item.sku })
            });

            const data = await response.json().catch(() => ({ success: false, error: 'Unknown error' }));

            // Handle out of stock explicitly returned from API
            if (data.success && data.outOfStock) {
                setTrackedItems(prev => prev.map(i =>
                    i.id === item.id ? {
                        ...i,
                        isUnavailable: true,
                        outOfStock: true,
                        status: 'deleted',
                        lastManualCheck: !isBackground ? new Date().toISOString() : i.lastManualCheck
                    } : i
                ));

                if (!isBackground) {
                    setToast({
                        message: `${item.name} is out of stock and moved to history`,
                        type: 'info'
                    });
                    setTimeout(() => setToast(null), 4000);
                }
                return;
            }

            // Handle non-200 responses gracefully
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            if (!data.success || !data.price) throw new Error(data.error || 'Could not fetch price');
            setTrackedItems(prev => prev.map(i => {
                if (i.id === item.id) {
                    const basePrice = data.originalPrice || i.retailPrice;
                    const threshold = basePrice * 0.5;
                    const shouldAlert = data.price < threshold && !i.alertTriggered;

                    // Offer detection
                    const hasOffer = data.price < basePrice;
                    const hadOffer = i.offerStartDate && !i.offerEndDate;
                    const now = new Date().toISOString();

                    let offerStartDate = i.offerStartDate;
                    let offerEndDate = i.offerEndDate;
                    let lastOfferDuration = i.lastOfferDuration;

                    // Offer started
                    if (hasOffer && !hadOffer) {
                        offerStartDate = now;
                        offerEndDate = undefined;
                        const savings = basePrice - data.price;
                        const percentOff = Math.round((savings / basePrice) * 100);
                        const newAlert: AlertMessage = {
                            id: generateUniqueId(),
                            sku: i.sku,
                            name: i.name,
                            message: `🎉 New offer on ${i.name}! Save KES ${savings.toFixed(2)} (${percentOff}% off)`,
                            time: new Date().toLocaleTimeString(),
                            type: 'alert',
                        };
                        setAlerts(p => [newAlert, ...p.slice(0, 9)]);
                    }

                    // Offer ended
                    if (!hasOffer && hadOffer && i.offerStartDate) {
                        offerEndDate = now;
                        const duration = new Date(now).getTime() - new Date(i.offerStartDate).getTime();
                        lastOfferDuration = duration;

                        // Format duration
                        const days = Math.floor(duration / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const durationText = days > 0 ? `${days} day${days > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''}`;

                        const newAlert: AlertMessage = {
                            id: generateUniqueId(),
                            sku: i.sku,
                            name: i.name,
                            message: `⏰ Offer ended on ${i.name}. It lasted ${durationText}`,
                            time: new Date().toLocaleTimeString(),
                            type: 'update',
                        };
                        setAlerts(p => [newAlert, ...p.slice(0, 9)]);
                    }

                    if (shouldAlert) {
                        const newAlert: AlertMessage = {
                            id: generateUniqueId(),
                            sku: i.sku,
                            name: i.name,
                            message: `🎉 ${i.name} dropped to KES ${data.price.toFixed(2)}`,
                            time: new Date().toLocaleTimeString(),
                            type: 'alert',
                        };
                        setAlerts(p => [newAlert, ...p.slice(0, 9)]);
                    }

                    return {
                        ...i,
                        currentPrice: data.price,
                        originalPrice: data.originalPrice || i.originalPrice,
                        lastUpdated: new Date().toISOString(),
                        lastManualCheck: !isBackground ? new Date().toISOString() : i.lastManualCheck,
                        priceHistory: [
                            { price: data.price, date: new Date().toLocaleString() },
                            ...i.priceHistory.slice(0, 29)
                        ],
                        alertTriggered: shouldAlert || i.alertTriggered,
                        imageUrl: data.imageUrl || i.imageUrl,
                        offerStartDate,
                        offerEndDate,
                        lastOfferDuration,
                        isUnavailable: false, // Reset unavailable flag on successful check
                        outOfStock: false, // Reset out of stock flag on successful check
                        status: 'active', // Ensure status is active if we found it
                    };
                }
                return i;
            }));
        } catch (error) {
            // Check if it's a 404 or "not found" error
            const errorMessage = error instanceof Error ? error.message : 'Unknown';
            // Only mark as unavailable if it's a 404 or explicit HTTP error
            // "Could not extract price" is treated as a temporary failure, not OOS
            const isNotFound = errorMessage.includes('404') ||
                errorMessage.includes('HTTP 4');

            // Mark item as unavailable/out of stock if not found
            if (isNotFound) {
                setTrackedItems(prev => prev.map(i =>
                    i.id === item.id ? {
                        ...i,
                        isUnavailable: true,
                        outOfStock: true, // Mark as out of stock
                        status: 'deleted', // Auto-move to history (deleted status)
                        lastManualCheck: !isBackground ? new Date().toISOString() : i.lastManualCheck
                    } : i
                ));

                // Notify user about out of stock item
                if (!isBackground) {
                    setToast({
                        message: `${item.name} is out of stock and moved to history`,
                        type: 'info'
                    });
                    setTimeout(() => setToast(null), 4000);
                } else {
                    // Add alert for background check
                    const oosAlert: AlertMessage = {
                        id: generateUniqueId(),
                        sku: item.sku,
                        name: item.name,
                        message: `Item out of stock: ${item.name}`,
                        time: new Date().toLocaleTimeString(),
                        type: 'error',
                    };
                    setAlerts(prev => [oosAlert, ...prev.slice(0, 9)]);
                }
            }

            // Only show alerts to user for manual checks, silently log background check failures
            if (!isBackground) {
                const errorAlert: AlertMessage = {
                    id: generateUniqueId(),
                    sku: item.sku,
                    name: item.name,
                    message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
                    time: new Date().toLocaleTimeString(),
                    type: 'error',
                };
                setAlerts(prev => [errorAlert, ...prev.slice(0, 4)]);
            } else {
                // Silent logging for background checks - no console spam
                console.debug(`Background check failed for ${item.name}:`, error instanceof Error ? error.message : 'Unknown');
            }
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    const checkSelectedItems = async () => {
        const itemsToCheck = trackedItems.filter(item =>
            selectedDeletedItems.has(item.id) && item.status === 'deleted'
        );

        if (itemsToCheck.length === 0) {
            setToast({
                message: 'No items selected',
                type: 'info'
            });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        setLoading(true);
        for (const item of itemsToCheck) {
            await checkPrice(item, false);
            // Small delay between checks
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        setLoading(false);
        setSelectedDeletedItems(new Set()); // Clear selection after checking
    };

    const toggleDeletedItemSelection = (id: string) => {
        setSelectedDeletedItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAllDeletedItems = () => {
        const deletedIds = trackedItems
            .filter(item => item.status === 'deleted')
            .map(item => item.id);
        setSelectedDeletedItems(new Set(deletedIds));
    };

    const deselectAllDeletedItems = () => {
        setSelectedDeletedItems(new Set());
    };

    const fetchOffers = async () => {
        // Check if we have cached offers less than 24 hours old
        if (lastOffersFetch) {
            const timeSinceLastFetch = Date.now() - new Date(lastOffersFetch).getTime();
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (timeSinceLastFetch < twentyFourHours && discoveredOffers.length > 0) {
                setToast({
                    message: 'Using cached offers (refreshes every 24 hours)',
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
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();

            if (!data.success || !data.offers) {
                throw new Error(data.error || 'Failed to fetch offers');
            }

            setDiscoveredOffers(data.offers);
            const timestamp = new Date().toISOString();
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

    const deleteItem = (id: string) => {
        setTrackedItems(prev => prev.map(item =>
            item.id === id ? { ...item, status: 'deleted' } : item
        ));
        setDeletedItemsCount(prev => prev + 1);
    };

    const addProject = () => {
        if (!newProjectName.trim()) return;
        const newProject: Project = {
            id: Date.now().toString(),
            name: newProjectName,
            category: newProjectCategory || 'General',
            createdAt: new Date().toISOString(),
            color: ['#064e3b', '#059669', '#10b981', '#34d399'][Math.floor(Math.random() * 4)]
        };
        setProjects([...projects, newProject]);
        setNewProjectName('');
        setNewProjectCategory('');
        setShowProjectModal(false);
    };

    const resetAlert = (id: string) => {
        setTrackedItems(trackedItems.map(item =>
            item.id === id ? { ...item, alertTriggered: false } : item
        ));
    };

    const totalTracked = trackedItems.length;
    const activeDeals = trackedItems.filter(item =>
        item.originalPrice && item.currentPrice &&
        ((item.originalPrice - item.currentPrice) / item.originalPrice) > 0.1
    ).length;
    const totalSavings = trackedItems.reduce((sum, item) => {
        if (item.originalPrice && item.currentPrice && item.originalPrice > item.currentPrice) {
            return sum + (item.originalPrice - item.currentPrice);
        }
        return sum;
    }, 0);
    const lastUpdatedItem = trackedItems.reduce((latest, item) => {
        if (!latest || !item.lastUpdated) return item;
        return new Date(item.lastUpdated) > new Date(latest.lastUpdated || 0) ? item : latest;
    }, trackedItems[0]);

    const filteredItems = trackedItems.filter(item =>
        item.status !== 'deleted' &&
        (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku.includes(searchQuery))
    );

    return (
        <div className="flex h-screen bg-[#f3f4f6] overflow-hidden font-sans">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            {/* Sidebar */}
            <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
                <div className="p-8 flex items-center gap-3 mb-8">
                    <img src="/logo.svg" alt="PriceWatch Logo" className="w-8 h-8 object-contain" />
                    <h1 className="text-xl font-bold text-green-900 tracking-tight">arbitrageDuka</h1>
                </div>

                <nav className="flex-1 px-6 space-y-6">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 mb-4 px-2 tracking-wider">MENU</p>
                        <div className="space-y-1">
                            <button
                                onClick={() => {
                                    setCurrentView('dashboard');
                                    setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentView === 'dashboard' ? 'bg-amber-100 text-amber-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <LayoutDashboard size={20} />
                                Dashboard
                            </button>
                            <Link
                                href="/offers"
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-gray-600 hover:bg-gray-50"
                            >
                                <Sparkles size={20} />
                                Available Offers
                            </Link>
                            <button
                                onClick={() => {
                                    setCurrentView('history');
                                    setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${currentView === 'history' ? 'bg-amber-100 text-amber-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <Clock size={20} />
                                History
                            </button>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-400 mb-4 px-2 tracking-wider">GENERAL</p>
                        <div className="space-y-1">
                            <button
                                onClick={() => { setCurrentView('help'); setSidebarOpen(false); }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 font-medium rounded-lg transition-colors ${currentView === 'help' ? 'text-green-800 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                            >
                                <div className="w-5 h-5 rounded border border-current flex items-center justify-center text-[10px]">?</div>
                                <span>Help & FAQ</span>
                            </button>
                        </div>
                    </div>
                </nav>

                {/* Legal Links */}
                <div className="p-6 mt-auto border-t border-gray-100">
                    <div className="flex flex-col gap-2 text-xs text-gray-400">
                        <a href="/terms" className="hover:text-green-800 transition-colors">Terms & Conditions</a>
                        <a href="/privacy" className="hover:text-green-800 transition-colors">Privacy Policy</a>
                        <p className="mt-2 text-[10px] text-gray-300">© 2025 arbitrageDuka</p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                {/* Top Bar */}
                <header className="bg-[#f3f4f6] px-4 sm:px-8 py-6 flex items-center justify-between gap-4">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-700 hover:text-gray-900"
                    >
                        <Menu size={20} />
                    </button>

                    {/* Search */}
                    <div className="relative flex-1 max-w-md lg:max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:outline-none focus:ring-2 focus:ring-green-800 text-sm placeholder-gray-400 text-gray-900"
                        />
                    </div>

                    {/* Right Side Actions */}
                    <div className="flex items-center gap-4">

                        <button
                            onClick={() => setShowAlertsPanel(!showAlertsPanel)}
                            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-700 relative"
                        >
                            <Clock size={20} />
                            {alerts.length > 0 && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                            )}
                        </button>
                        <div className="flex items-center gap-3 ml-2">
                            <div className="w-10 h-10 rounded-full bg-orange-200 overflow-hidden">
                                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
                            </div>
                            <div className="hidden md:block">
                                <p className="text-sm font-bold text-gray-900 leading-tight">Vibecode Kijana</p>
                                <p className="text-xs text-gray-400">vibecodekijana@gmail.com</p>
                            </div>
                        </div>

                        {/* Alerts Panel */}
                        {showAlertsPanel && (
                            <div className="absolute top-16 right-4 sm:right-8 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900">Notifications</h3>
                                    <button
                                        onClick={() => setShowAlertsPanel(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="overflow-y-auto flex-1">
                                    {alerts.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400">
                                            <Clock size={32} className="mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No notifications yet</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {alerts.map(alert => (
                                                <div key={alert.id} className="p-4 hover:bg-gray-50 transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${alert.type === 'alert' ? 'bg-green-500' :
                                                            alert.type === 'error' ? 'bg-red-500' :
                                                                alert.type === 'success' ? 'bg-blue-500' :
                                                                    'bg-gray-400'
                                                            }`}></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-gray-900 font-medium">{alert.message}</p>
                                                            <p className="text-xs text-gray-400 mt-1">{alert.time}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* Toast Notification */}
                {toast && (
                    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] animate-fade-in">
                        <div className={`px-6 py-3 rounded-full shadow-lg border flex items-center gap-2 ${toast.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-900' :
                            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
                                'bg-green-50 border-green-200 text-green-900'
                            }`}>
                            <Clock size={16} />
                            <span className="font-medium text-sm">{toast.message}</span>
                        </div>
                    </div>
                )}

                {/* Main Dashboard Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {currentView === 'dashboard' && (
                        <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
                            {/* Dashboard Header & Actions */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
                                    <p className="text-gray-500 mt-1">Plan, prioritize, and accomplish your tasks with ease.</p>
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <button
                                        onClick={fetchOffers}
                                        disabled={offersLoading}
                                        className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-initial"
                                    >
                                        <Sparkles size={18} className={offersLoading ? 'animate-spin' : ''} />
                                        <span className="hidden sm:inline">Refresh Offers</span>
                                    </button>
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-2.5 rounded-full font-medium transition-colors flex-1 sm:flex-initial"
                                    >
                                        <Plus size={18} />
                                        <span className="hidden sm:inline">Add Product</span>
                                    </button>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-green-50 rounded-2xl">
                                            <Package className="text-green-700" size={24} />
                                        </div>
                                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium">Total Tracked</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{totalTracked}</h3>
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-blue-50 rounded-2xl">
                                            <TrendingDown className="text-blue-700" size={24} />
                                        </div>
                                        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Active</span>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium">Active Deals</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{activeDeals}</h3>
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-amber-50 rounded-2xl">
                                            <TrendingUp className="text-amber-700" size={24} />
                                        </div>
                                        <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Saved</span>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium">Total Savings</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">KES {totalSavings.toLocaleString()}</h3>
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:border-green-200 transition-colors" onClick={() => setShowTargetModal(true)}>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-purple-50 rounded-2xl">
                                            <Check className="text-purple-700" size={24} />
                                        </div>
                                        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Target</span>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium">Target Savings</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                        {targetSavings ? `KES ${targetSavings.toLocaleString()}` : 'Set Target'}
                                    </h3>
                                    {targetSavings && (
                                        <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min((totalSavings / targetSavings) * 100, 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Savings Chart */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900">Savings Overview</h3>
                                    <select className="bg-gray-50 border-none text-sm font-medium text-gray-500 rounded-lg px-3 py-1.5 focus:ring-0 cursor-pointer hover:text-gray-700">
                                        <option>This Week</option>
                                        <option>This Month</option>
                                        <option>This Year</option>
                                    </select>
                                </div>
                                <div className="h-64 w-full">
                                    <SavingsChart trackedItems={trackedItems} />
                                </div>
                            </div>

                            {/* Product List */}
                            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h3 className="text-lg font-bold text-gray-900">Tracked Products</h3>
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Search products..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-green-500/20 focus:outline-none w-full sm:w-64"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6">
                                    {filteredItems.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Search className="text-gray-400" size={24} />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 mb-2">No products found</h3>
                                            <p className="text-gray-500">
                                                {searchQuery ? `No results for "${searchQuery}"` : "Start tracking products to see them here!"}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                            {filteredItems.map((item) => {
                                                const isDeal = item.originalPrice && item.currentPrice && item.currentPrice < item.originalPrice;
                                                const savings = isDeal ? item.originalPrice! - item.currentPrice! : 0;
                                                const percentOff = isDeal ? Math.round((savings / item.originalPrice!) * 100) : 0;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => {
                                                            setSelectedProduct(item);
                                                            setShowDetailModal(true);
                                                        }}
                                                        className="group bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] flex flex-col cursor-pointer relative overflow-hidden"
                                                    >
                                                        {/* Status Badges */}
                                                        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                                                            {isDeal && (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-sm">
                                                                    -{percentOff}%
                                                                </span>
                                                            )}
                                                            {item.outOfStock && (
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-800 text-white shadow-sm">
                                                                    Out of Stock
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Actions Overlay (Visible on Hover/Touch) */}
                                                        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    checkPrice(item);
                                                                }}
                                                                disabled={loading}
                                                                className="p-2 bg-white/90 backdrop-blur-sm text-gray-500 hover:text-blue-600 rounded-full shadow-sm border border-gray-100 transition-colors"
                                                                title="Check Price"
                                                            >
                                                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                                            </button>
                                                            <a
                                                                href={item.link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="p-2 bg-white/90 backdrop-blur-sm text-gray-500 hover:text-gray-900 rounded-full shadow-sm border border-gray-100 transition-colors"
                                                                title="View on Site"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </a>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    deleteItem(item.id);
                                                                }}
                                                                className="p-2 bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-600 rounded-full shadow-sm border border-gray-100 transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>

                                                        {/* Image */}
                                                        <div className="w-full aspect-square bg-gray-50 rounded-xl mb-4 overflow-hidden p-4">
                                                            {item.imageUrl ? (
                                                                <img
                                                                    src={item.imageUrl}
                                                                    alt={item.name}
                                                                    className="w-full h-full object-contain mix-blend-multiply"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                    <Package size={32} />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 flex flex-col">
                                                            <h3 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2 group-hover:text-amber-600 transition-colors" title={item.name}>
                                                                {item.name}
                                                            </h3>
                                                            <p className="text-xs text-gray-400 mb-3 truncate">{item.sku}</p>

                                                            <div className="mt-auto">
                                                                <div className="flex items-baseline gap-2 mb-2">
                                                                    <span className="text-lg font-bold text-gray-900">
                                                                        KES {item.currentPrice?.toLocaleString()}
                                                                    </span>
                                                                    {item.originalPrice && item.currentPrice && item.originalPrice > item.currentPrice && (
                                                                        <span className="text-xs text-gray-400 line-through">
                                                                            {item.originalPrice.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
                                                                    <span>{getRelativeTime(item.lastUpdated)}</span>
                                                                    {isDeal && (
                                                                        <span className="text-green-600 font-medium">
                                                                            Save KES {savings.toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentView === 'history' && (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-3xl font-bold text-gray-900">History</h2>
                                    <p className="text-gray-500 mt-1">View and manage your deleted items.</p>
                                </div>
                                {selectedDeletedItems.size > 0 && (
                                    <div className="flex items-center gap-3 animate-fade-in">
                                        <span className="text-sm text-gray-500 font-medium">
                                            {selectedDeletedItems.size} selected
                                        </span>
                                        <button
                                            onClick={checkSelectedItems}
                                            disabled={loading}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                            Check Prices
                                        </button>
                                        <button
                                            onClick={deselectAllDeletedItems}
                                            className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-gray-900">Deleted Items</h3>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={selectAllDeletedItems}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            Select All
                                        </button>
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {trackedItems.filter(item => item.status === 'deleted').length === 0 ? (
                                        <div className="p-12 text-center text-gray-400">
                                            <Trash2 size={32} className="mx-auto mb-3 opacity-50" />
                                            <p>No deleted items found</p>
                                        </div>
                                    ) : (
                                        trackedItems
                                            .filter(item => item.status === 'deleted')
                                            .map(item => (
                                                <div key={item.id} className={`p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${selectedDeletedItems.has(item.id) ? 'bg-blue-50/50' : ''}`}>
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDeletedItems.has(item.id)}
                                                            onChange={() => toggleDeletedItemSelection(item.id)}
                                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="w-12 h-12 bg-white rounded-xl border border-gray-100 p-2 flex-shrink-0 opacity-50 grayscale">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                <Package size={20} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0 opacity-75">
                                                        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                                        <p className="text-xs text-gray-500">{item.sku}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-sm font-bold text-gray-900">KES {item.currentPrice?.toLocaleString()}</p>
                                                        <div className="flex items-center justify-end gap-2 mt-1">
                                                            {item.outOfStock && (
                                                                <span className="text-[10px] font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                                                                    Out of Stock
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => {
                                                                    setTrackedItems(prev => prev.map(i =>
                                                                        i.id === item.id ? { ...i, status: 'active', isUnavailable: false, outOfStock: false } : i
                                                                    ));
                                                                    setDeletedItemsCount(prev => Math.max(0, prev - 1));
                                                                }}
                                                                className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                                            >
                                                                Restore
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {currentView === 'help' && (
                        <div className="max-w-3xl mx-auto space-y-8">
                            <div className="text-center mb-12">
                                <h2 className="text-3xl font-bold text-gray-900 mb-4">How can we help?</h2>
                                <div className="relative max-w-md mx-auto">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="Search for answers..."
                                        className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-800"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-6">
                                {[
                                    {
                                        q: "How does the tracking work?",
                                        a: "We monitor product pages periodically. When a price change is detected, we update your dashboard and send you a notification if it meets your alert criteria."
                                    },
                                    {
                                        q: "How often are prices updated?",
                                        a: "Prices are checked automatically every 30 minutes in the background. You can also manually refresh any item's price by clicking the refresh icon."
                                    },
                                    {
                                        q: "What stores are supported?",
                                        a: "Currently we support Carrefour Kenya. We are working on adding more retailers soon."
                                    },
                                    {
                                        q: "Is it free to use?",
                                        a: "Yes! arbitrageDuka is completely free to use for tracking up to 50 items."
                                    }
                                ].map((faq, i) => (
                                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="font-bold text-gray-900 mb-2">{faq.q}</h3>
                                        <p className="text-gray-500">{faq.a}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-green-900 text-white p-8 rounded-[2rem] text-center mt-12">
                                <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
                                <p className="text-green-100 mb-6">Our support team is always ready to help you.</p>
                                <button className="bg-white text-green-900 px-6 py-3 rounded-xl font-bold hover:bg-green-50 transition-colors">
                                    Contact Support
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Add Product Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-900">Add Product</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Product Link</label>
                                <input
                                    type="text"
                                    value={productLink}
                                    onChange={(e) => setProductLink(e.target.value)}
                                    placeholder="Paste Carrefour URL here..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-800 transition-all"
                                />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl flex gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg h-fit">
                                    <Sparkles size={18} className="text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900 text-sm">Smart Extraction</h4>
                                    <p className="text-xs text-blue-700 mt-1">
                                        We'll automatically extract the product name, price, and image from the link.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={scrapeAndAddProduct}
                                disabled={loading}
                                className="w-full bg-green-900 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw size={20} className="animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={20} />
                                        Track Product
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Target Savings Modal */}
            {showTargetModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold text-gray-900">Set Savings Target</h3>
                            <button
                                onClick={() => setShowTargetModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Target Amount (KES)</label>
                                <input
                                    type="number"
                                    value={targetInput}
                                    onChange={(e) => setTargetInput(e.target.value)}
                                    placeholder="e.g. 5000"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-800 transition-all"
                                />
                            </div>

                            <button
                                onClick={() => {
                                    if (targetInput) {
                                        setTargetSavings(Number(targetInput));
                                        setShowTargetModal(false);
                                        setTargetInput('');
                                    }
                                }}
                                className="w-full bg-green-900 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-lg transition-all transform active:scale-[0.98]"
                            >
                                Set Target
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Detail Modal */}
            {showDetailModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">
                        <div className="relative">
                            <button
                                onClick={() => setShowDetailModal(false)}
                                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm hover:bg-white rounded-full shadow-sm transition-colors z-10"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>

                            <div className="aspect-video bg-gray-50 w-full flex items-center justify-center p-8">
                                {selectedProduct.imageUrl ? (
                                    <img
                                        src={selectedProduct.imageUrl}
                                        alt={selectedProduct.name}
                                        className="w-full h-full object-contain mix-blend-multiply"
                                    />
                                ) : (
                                    <Package size={64} className="text-gray-300" />
                                )}
                            </div>

                            <div className="p-8">
                                <div className="flex items-start justify-between gap-4 mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedProduct.name}</h2>
                                        <p className="text-sm text-gray-500 font-mono">{selectedProduct.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-3xl font-bold text-gray-900">KES {selectedProduct.currentPrice?.toLocaleString()}</p>
                                        {selectedProduct.originalPrice && selectedProduct.currentPrice && selectedProduct.originalPrice > selectedProduct.currentPrice && (
                                            <p className="text-sm text-green-600 font-medium mt-1">
                                                Save KES {(selectedProduct.originalPrice - selectedProduct.currentPrice).toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-gray-50 p-4 rounded-2xl">
                                        <p className="text-xs text-gray-500 mb-1">Highest Price</p>
                                        <p className="font-bold text-gray-900">
                                            KES {Math.max(...selectedProduct.priceHistory.map(p => p.price)).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-2xl">
                                        <p className="text-xs text-gray-500 mb-1">Lowest Price</p>
                                        <p className="font-bold text-gray-900">
                                            KES {Math.min(...selectedProduct.priceHistory.map(p => p.price)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-900">Price History</h3>
                                    <div className="h-48 w-full bg-gray-50 rounded-2xl p-4">
                                        <ProductHistoryChart history={selectedProduct.priceHistory} />
                                    </div>
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <a
                                        href={selectedProduct.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 bg-green-900 hover:bg-green-800 text-white py-4 rounded-xl font-bold text-center transition-colors flex items-center justify-center gap-2"
                                    >
                                        View on Carrefour
                                        <ExternalLink size={18} />
                                    </a>
                                    <button
                                        onClick={() => checkPrice(selectedProduct)}
                                        disabled={loading}
                                        className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
