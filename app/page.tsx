'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TrendingDown, Plus, Trash2, Clock, LayoutDashboard, Package, Settings, X, Search, DollarSign, ShoppingCart, Menu } from 'lucide-react';
import { TrackedItem, AlertMessage } from '@/lib/types';
import { extractSKUFromLink, extractProductName, isBelowThreshold, pricePercentage } from '@/lib/utils';

const MIN_CHECK_INTERVAL = 5 * 60 * 1000;
const BACKGROUND_POLL_INTERVAL = 10 * 60 * 1000;

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
  }, []);

  useEffect(() => {
    if (trackedItems.length > 0) {
      localStorage.setItem('price-tracker-items', JSON.stringify(trackedItems));
    }
  }, [trackedItems]);

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
    if (!item.lastUpdated) return true;
    const lastCheck = new Date(item.lastUpdated).getTime();
    return Date.now() - lastCheck >= MIN_CHECK_INTERVAL;
  };

  const checkAllPrices = async () => {
    const itemsToCheck = trackedItems.filter(shouldCheckItem);
    if (itemsToCheck.length === 0) return;
    setBackgroundChecking(true);
    for (const item of itemsToCheck) {
      await checkPrice(item, true);
      await new Promise(resolve => setTimeout(resolve, 2000));
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
      };
      setTrackedItems([...trackedItems, newItem]);
      setProductLink('');
      setShowAddModal(false);
      const successAlert: AlertMessage = {
        id: Date.now(),
        sku: data.sku,
        name: data.name,
        message: `✓ Added ${data.name}`,
        time: new Date().toLocaleTimeString(),
        type: 'success',
      };
      setAlerts(prev => [successAlert, ...prev.slice(0, 4)]);
    } catch (error) {
      const errorAlert: AlertMessage = {
        id: Date.now(),
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
    if (!isBackground) setLoading(true);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.link, sku: item.sku })
      });
      const data = await response.json();
      if (!data.success || !data.price) throw new Error(data.error || 'Could not fetch price');
      setTrackedItems(prev => prev.map(i => {
        if (i.id === item.id) {
          const basePrice = data.originalPrice || i.retailPrice;
          const threshold = basePrice * 0.5;
          const shouldAlert = data.price < threshold && !i.alertTriggered;
          if (shouldAlert) {
            const newAlert: AlertMessage = {
              id: Date.now(),
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
            priceHistory: [
              { price: data.price, date: new Date().toLocaleString() },
              ...i.priceHistory.slice(0, 29)
            ],
            alertTriggered: shouldAlert || i.alertTriggered,
          };
        }
        return i;
      }));
    } catch (error) {
      if (!isBackground) {
        const errorAlert: AlertMessage = {
          id: Date.now(),
          sku: item.sku,
          name: item.name,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
          time: new Date().toLocaleTimeString(),
          type: 'error',
        };
        setAlerts(prev => [errorAlert, ...prev.slice(0, 4)]);
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const deleteItem = (id: string) => {
    setTrackedItems(trackedItems.filter(item => item.id !== id));
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
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku.includes(searchQuery)
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-green-700 flex items-center gap-2">
            <ShoppingCart className="text-green-700" size={28} />
            <span className="hidden sm:inline">PriceWatch</span>
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-white bg-green-700 rounded-lg font-medium">
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium">
              <Package size={20} />
              <span>Tracked Items</span>
              <span className="ml-auto bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">{totalTracked}</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium">
              <Settings size={20} />
              <span>Settings</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu size={24} />
            </button>
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
            </div>
            {backgroundChecking && (
              <div className="hidden sm:flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                <Clock className="animate-spin" size={16} />
                <span className="text-sm font-medium hidden md:inline">Checking...</span>
              </div>
            )}
          </div>
        </header>

        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h2>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Monitor and track your favorite Carrefour products</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
              <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-green-100 text-xs sm:text-sm font-medium">Total</p>
                  <Package className="text-green-200" size={18} />
                </div>
                <p className="text-3xl sm:text-4xl font-bold">{totalTracked}</p>
                <p className="text-green-100 text-xs mt-1 sm:mt-2">Products</p>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600 text-xs sm:text-sm font-medium">Deals</p>
                  <TrendingDown className="text-orange-500" size={18} />
                </div>
                <p className="text-3xl sm:text-4xl font-bold text-gray-900">{activeDeals}</p>
                <p className="text-gray-500 text-xs mt-1 sm:mt-2">Active</p>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600 text-xs sm:text-sm font-medium">Savings</p>
                  <DollarSign className="text-green-500" size={18} />
                </div>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">KES {totalSavings.toFixed(0)}</p>
                <p className="text-gray-500 text-xs mt-1 sm:mt-2">Total</p>
              </div>

              <div className="bg-white rounded-xl p-4 sm:p-6 shadow border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-600 text-xs sm:text-sm font-medium">Updated</p>
                  <Clock className="text-blue-500" size={18} />
                </div>
                <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">{getRelativeTime(lastUpdatedItem?.lastUpdated)}</p>
                <p className="text-gray-500 text-xs mt-1 sm:mt-2">Last check</p>
              </div>
            </div>

            {/* Products Grid */}
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Tracked Products</h3>
              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-xl p-8 sm:p-12 text-center border border-gray-200">
                  <Package className="mx-auto text-gray-300 mb-4" size={48} />
                  <p className="text-gray-500 text-base sm:text-lg">No products tracked yet</p>
                  <p className="text-gray-400 text-sm mt-2">Click the + button to add your first product</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {filteredItems.map(item => (
                    <div key={item.id} className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="p-4 sm:p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-base sm:text-lg leading-tight mb-1 line-clamp-2">{item.name}</h4>
                            <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                          </div>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>

                        <div className="mb-4">
                          {item.currentPrice ? (
                            <div>
                              <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                                <p className={`text-2xl sm:text-3xl font-bold ${isBelowThreshold(item.currentPrice, item.originalPrice || item.retailPrice)
                                  ? 'text-green-600'
                                  : 'text-gray-900'
                                  }`}>
                                  KES {item.currentPrice.toLocaleString()}
                                </p>
                                {item.originalPrice && item.originalPrice > item.currentPrice && (
                                  <p className="text-xs sm:text-sm text-gray-400 line-through">
                                    KES {item.originalPrice.toLocaleString()}
                                  </p>
                                )}
                              </div>
                              {item.originalPrice && item.originalPrice > item.currentPrice && (
                                <div className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                  {Math.round((item.originalPrice - item.currentPrice) / item.originalPrice * 100)}% OFF
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-400">Checking...</p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{getRelativeTime(item.lastUpdated)}</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedProduct(item);
                              setShowDetailModal(true);
                            }}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                          >
                            View Details
                          </button>
                          {item.alertTriggered && (
                            <button
                              onClick={() => resetAlert(item.id)}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>

                        {isBelowThreshold(item.currentPrice, item.originalPrice || item.retailPrice) && (
                          <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 p-2 sm:p-3 rounded-lg border border-green-100">
                            <TrendingDown size={16} />
                            <span className="text-xs font-bold">Great deal!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Floating Add Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 bg-green-600 hover:bg-green-700 text-white p-3 sm:p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-20"
      >
        <Plus size={24} />
      </button>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Add Product</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Paste a Carrefour product link to start tracking</p>
            <input
              type="text"
              placeholder="https://www.carrefour.ke/..."
              value={productLink}
              onChange={(e) => setProductLink(e.target.value)}
              disabled={loading}
              onKeyPress={(e) => e.key === 'Enter' && scrapeAndAddProduct()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 mb-4 text-sm"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={scrapeAndAddProduct}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg px-4 py-3 font-medium transition-colors text-sm"
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-xl my-8">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Product Details</h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Product Image */}
              {selectedProduct.imageUrl && (
                <div className="w-full aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Product Info */}
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{selectedProduct.name}</h4>
                <p className="text-sm text-gray-500">SKU: {selectedProduct.sku}</p>
              </div>

              {/* Price Section */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium mb-1">Current Price</p>
                    <p className={`text-3xl sm:text-4xl font-bold ${isBelowThreshold(selectedProduct.currentPrice || 0, selectedProduct.originalPrice || selectedProduct.retailPrice)
                        ? 'text-green-600'
                        : 'text-gray-900'
                      }`}>
                      KES {selectedProduct.currentPrice?.toLocaleString() || 'N/A'}
                    </p>
                  </div>

                  {selectedProduct.originalPrice && selectedProduct.originalPrice > (selectedProduct.currentPrice || 0) && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Original Price</p>
                      <p className="text-xl sm:text-2xl text-gray-400 line-through">
                        KES {selectedProduct.originalPrice.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {selectedProduct.originalPrice && selectedProduct.currentPrice && selectedProduct.originalPrice > selectedProduct.currentPrice && (
                  <div className="inline-block bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-bold">
                    Save {Math.round((selectedProduct.originalPrice - selectedProduct.currentPrice) / selectedProduct.originalPrice * 100)}%
                    (KES {(selectedProduct.originalPrice - selectedProduct.currentPrice).toLocaleString()})
                  </div>
                )}
              </div>

              {/* Price History */}
              {selectedProduct.priceHistory.length > 1 && (
                <div>
                  <h5 className="font-bold text-gray-900 mb-3">Price History</h5>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2">
                    {selectedProduct.priceHistory.slice(0, 10).map((h, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{h.date}</span>
                        <span className="font-medium text-gray-900">KES {h.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Last Updated */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} />
                <span>Last updated {getRelativeTime(selectedProduct.lastUpdated)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <a
                  href={selectedProduct.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center px-4 py-3 rounded-lg font-medium transition-colors"
                >
                  Buy on Carrefour →
                </a>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedProduct(null);
                  }}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
