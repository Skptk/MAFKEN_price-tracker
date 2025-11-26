'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Menu, X, Trash2, ExternalLink, RefreshCw, TrendingDown, TrendingUp, Clock, AlertTriangle, Check, ChevronRight, LayoutDashboard, Package } from 'lucide-react';
import SavingsChart from './components/SavingsChart';
import { TrackedItem, AlertMessage, Project } from '@/lib/types';
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletedItemsCount, setDeletedItemsCount] = useState(0);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetSavings, setTargetSavings] = useState<number | null>(null);
  const [targetInput, setTargetInput] = useState('');

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
            imageUrl: data.imageUrl || i.imageUrl, // Update image URL if available
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
          <h1 className="text-xl font-bold text-green-900 tracking-tight">aggregateDuka</h1>
        </div>

        <nav className="flex-1 px-6 space-y-6">
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-4 px-2 tracking-wider">MENU</p>
            <div className="space-y-1">
              <button
                onClick={() => { setCurrentView('dashboard'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 font-semibold rounded-lg transition-colors ${currentView === 'dashboard' ? 'text-green-800 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </button>
              <button
                onClick={() => { setCurrentView('history'); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 font-medium rounded-lg transition-colors ${currentView === 'history' ? 'text-green-800 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <Clock size={20} />
                <span>History</span>
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
            <p className="mt-2 text-[10px] text-gray-300">© 2025 aggregateDuka</p>
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
            <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-700">
              <div className="w-5 h-5 border-2 border-current rounded-md flex items-center justify-center text-[10px] font-bold">@</div>
            </button>
            <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-500 hover:text-gray-700 relative">
              <Clock size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>
            <div className="flex items-center gap-3 ml-2">
              <div className="w-10 h-10 rounded-full bg-orange-200 overflow-hidden">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" />
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-bold text-gray-900 leading-tight">Totok Michael</p>
                <p className="text-xs text-gray-400">tmichael20@mail.com</p>
              </div>
            </div>
          </div>
        </header>

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
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center gap-2 bg-[#064e3b] hover:bg-[#065f46] text-white px-6 py-2.5 rounded-full font-medium transition-colors w-full sm:w-auto"
                >
                  <Plus size={18} />
                  <span className="text-sm sm:text-base">Add Product</span>
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Card 1: Projects (Green) */}
                <div className="bg-gradient-to-br from-[#064e3b] to-[#065f46] rounded-[2rem] p-6 text-white shadow-lg relative overflow-hidden">
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <p className="text-green-100 font-medium">Projects</p>
                    <button
                      onClick={() => setShowProjectModal(true)}
                      className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Plus className="text-white" size={16} />
                    </button>
                  </div>
                  <p className="text-5xl font-bold mb-4 relative z-10">{projects.length}</p>
                  <div className="flex items-center gap-2 text-xs text-green-100 relative z-10">
                    <div className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">{projects.length > 0 ? '+' : ''}{projects.length}</div>
                    <span>Active projects</span>
                  </div>
                  {/* Abstract bg shape */}
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
                </div>

                {/* Card 2: Ended Projects (White) */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-gray-900 font-bold">Ended Projects</p>
                    <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
                      <TrendingDown className="text-gray-400 rotate-180" size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-gray-900 mb-4">{deletedItemsCount}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">Total</div>
                    <span>Deleted items</span>
                  </div>
                </div>

                {/* Card 3: Running Projects (White) */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-gray-900 font-bold">Running Projects</p>
                    <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
                      <TrendingDown className="text-gray-400 rotate-180" size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-gray-900 mb-4">{trackedItems.length}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-600">Total</div>
                    <span>Tracked items</span>
                  </div>
                </div>

                {/* Card 4: Pending Project (White) */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-4">
                    <p className="text-gray-900 font-bold">Pending Project</p>
                    <div className="w-8 h-8 border border-gray-200 rounded-full flex items-center justify-center">
                      <TrendingDown className="text-gray-400 rotate-180" size={16} />
                    </div>
                  </div>
                  <p className="text-5xl font-bold text-gray-900 mb-4">
                    {trackedItems.filter(i => i.originalPrice && i.currentPrice && i.currentPrice < i.originalPrice).length}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Active offers</span>
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Savings Over Time Chart */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 lg:col-span-2 min-h-[300px] relative">
                  <SavingsChart
                    trackedItems={trackedItems}
                    targetSavings={targetSavings}
                    onSetTarget={() => {
                      setTargetInput(targetSavings?.toString() || '');
                      setShowTargetModal(true);
                    }}
                  />
                </div>

                {/* Project List */}
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-gray-900">Projects</h3>
                    <button
                      onClick={() => setShowProjectModal(true)}
                      className="flex items-center gap-1 text-xs font-medium border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 transition-colors"
                    >
                      <Plus size={12} /> New
                    </button>
                  </div>
                  <div className="space-y-4">
                    {projects.slice(0, 4).map(project => (
                      <div key={project.id} className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                          style={{ backgroundColor: project.color || '#064e3b' }}
                        >
                          <Package size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">{project.name}</h4>
                          <p className="text-[10px] text-gray-400">
                            {project.category} • {trackedItems.filter(i => i.projectId === project.id).length} items
                          </p>
                        </div>
                      </div>
                    ))}
                    {projects.length === 0 && <p className="text-sm text-gray-400">No projects yet. Click "+New" to create one.</p>}
                  </div>
                </div>
              </div>

              {/* Tracked Products List (Full Width) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Tracked Products</h3>
                  <button className="text-sm text-green-700 font-medium hover:underline">View All</button>
                </div>

                {filteredItems.length === 0 ? (
                  <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100">
                    <Package className="mx-auto text-gray-300 mb-4" size={48} />
                    <p className="text-gray-500 text-lg">No products tracked yet</p>
                    <p className="text-gray-400 text-sm mt-2">Click "Add Product" to start tracking</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredItems.map(item => (
                      <div key={item.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">In Progress</p>
                              </div>
                              <h4 className="font-bold text-gray-900 text-lg leading-tight mb-1 line-clamp-2 group-hover:text-green-800 transition-colors">{item.name}</h4>
                              <p className="text-xs text-gray-400">SKU: {item.sku}</p>
                              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                <Clock size={12} />
                                <span>Updated {getRelativeTime(item.lastUpdated)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>

                          <div className="mb-6">
                            {item.currentPrice ? (
                              <div>
                                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                                  <p className={`text-3xl font-bold ${isBelowThreshold(item.currentPrice, item.originalPrice || item.retailPrice)
                                    ? 'text-green-700'
                                    : 'text-gray-900'
                                    }`}>
                                    KES {item.currentPrice.toLocaleString()}
                                  </p>
                                </div>
                                {item.originalPrice && item.originalPrice > item.currentPrice && (
                                  <div className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-bold">
                                    <TrendingDown size={12} />
                                    {Math.round((item.originalPrice - item.currentPrice) / item.originalPrice * 100)}% OFF
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-400">Checking...</p>
                            )}
                          </div>

                          {/* Progress Bar Mock */}
                          <div className="w-full bg-gray-100 h-1.5 rounded-full mb-4 overflow-hidden">
                            <div className="bg-[#064e3b] h-full rounded-full" style={{ width: '65%' }}></div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-2">
                              <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200"></div>
                              <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-300"></div>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedProduct(item);
                                setShowDetailModal(true);
                              }}
                              className="text-sm font-bold text-gray-900 hover:text-green-800"
                            >
                              View Details →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentView === 'history' && (
            <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">History</h2>
                  <p className="text-gray-500 mt-1">View all products you've tracked over time.</p>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Date Added</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Current Price</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {trackedItems.sort((a, b) => new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime()).map(item => (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package size={20} className="text-gray-400" />
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 text-sm line-clamp-1">{item.name}</p>
                                <p className="text-xs text-gray-400">{item.sku}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.status === 'deleted' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                              {item.status === 'deleted' ? 'Deleted' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {item.dateAdded ? new Date(item.dateAdded).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">
                            {item.currentPrice ? `KES ${item.currentPrice.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => { setSelectedProduct(item); setShowDetailModal(true); }}
                              className="text-green-700 hover:text-green-900 text-sm font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {trackedItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                            No history available yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {currentView === 'help' && (
            <div className="max-w-3xl mx-auto space-y-8 flex-1">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Help & FAQ</h2>
                <p className="text-gray-500 mt-1">Learn how to use PriceWatch effectively.</p>
              </div>

              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 space-y-8">

                {/* About Section */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">About aggregateDuka</h3>
                  <p className="text-gray-600 leading-relaxed">
                    aggregateDuka is a powerful tool designed to help you track prices of products from Carrefour Kenya.
                    Simply add a product link, and we'll monitor the price for you. You can organize products into projects,
                    view price history, and get alerts when prices drop.
                  </p>
                </div>

                {/* Getting Started Guide */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Getting Started</h3>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold mb-3">1</div>
                      <h4 className="font-bold text-gray-900 mb-1">Find Product</h4>
                      <p className="text-sm text-gray-600">Go to Carrefour Kenya's website and find a product you want to track.</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold mb-3">2</div>
                      <h4 className="font-bold text-gray-900 mb-1">Copy Link</h4>
                      <p className="text-sm text-gray-600">Copy the full URL (web address) of the product page.</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-xl">
                      <div className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold mb-3">3</div>
                      <h4 className="font-bold text-gray-900 mb-1">Add to Tracker</h4>
                      <p className="text-sm text-gray-600">Click "Add Product" in aggregateDuka and paste the link.</p>
                    </div>
                  </div>
                </div>

                {/* Dashboard Guide */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Understanding Your Dashboard</h3>
                  <ul className="space-y-3 text-gray-600">
                    <li className="flex gap-3">
                      <LayoutDashboard className="text-green-700 flex-shrink-0" size={20} />
                      <span><strong>Projects:</strong> Organize your items into groups like "Groceries", "Tech", or "Wishlist".</span>
                    </li>
                    <li className="flex gap-3">
                      <TrendingDown className="text-green-700 flex-shrink-0" size={20} />
                      <span><strong>Pending Projects:</strong> Items that have dropped in price since you started tracking them.</span>
                    </li>
                    <li className="flex gap-3">
                      <Clock className="text-green-700 flex-shrink-0" size={20} />
                      <span><strong>History:</strong> View a timeline of all price changes for your tracked items.</span>
                    </li>
                  </ul>
                </div>

                {/* Expanded FAQs */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h3>
                  <div className="space-y-4">
                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-gray-50 rounded-xl font-medium text-gray-900 hover:bg-gray-100 transition-colors">
                        <span>How often are prices updated?</span>
                        <span className="transition group-open:rotate-180">
                          <TrendingDown size={16} />
                        </span>
                      </summary>
                      <div className="text-gray-600 mt-3 px-4 pb-2">
                        Prices are checked automatically in the background every few hours. You can also manually refresh a product's price instantly by opening its details page.
                      </div>
                    </details>

                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-gray-50 rounded-xl font-medium text-gray-900 hover:bg-gray-100 transition-colors">
                        <span>How do alerts work?</span>
                        <span className="transition group-open:rotate-180">
                          <TrendingDown size={16} />
                        </span>
                      </summary>
                      <div className="text-gray-600 mt-3 px-4 pb-2">
                        We highlight items in <strong>green</strong> when their price drops below the original price you tracked. If a price drops significantly (more than 50%), you'll get a special alert notification in the app.
                      </div>
                    </details>

                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-gray-50 rounded-xl font-medium text-gray-900 hover:bg-gray-100 transition-colors">
                        <span>What is the "Target Savings" feature?</span>
                        <span className="transition group-open:rotate-180">
                          <TrendingDown size={16} />
                        </span>
                      </summary>
                      <div className="text-gray-600 mt-3 px-4 pb-2">
                        The "Target Savings" line on your chart helps you visualize a goal. For example, if you want to save KES 5,000 this month, set that as your target, and watch your potential savings grow towards it as prices drop.
                      </div>
                    </details>

                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-gray-50 rounded-xl font-medium text-gray-900 hover:bg-gray-100 transition-colors">
                        <span>Can I track products from other stores?</span>
                        <span className="transition group-open:rotate-180">
                          <TrendingDown size={16} />
                        </span>
                      </summary>
                      <div className="text-gray-600 mt-3 px-4 pb-2">
                        Currently, aggregateDuka supports <strong>Carrefour Kenya</strong> exclusively. We are working on adding support for more retailers like Naivas and Quickmart in the future.
                      </div>
                    </details>

                    <details className="group">
                      <summary className="flex items-center justify-between cursor-pointer list-none p-4 bg-gray-50 rounded-xl font-medium text-gray-900 hover:bg-gray-100 transition-colors">
                        <span>Is this service free?</span>
                        <span className="transition group-open:rotate-180">
                          <TrendingDown size={16} />
                        </span>
                      </summary>
                      <div className="text-gray-600 mt-3 px-4 pb-2">
                        Yes! aggregateDuka is completely free to use. We do not charge any fees for tracking prices or sending alerts.
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-auto pt-8 pb-4 text-center text-xs text-gray-400 border-t border-gray-100">
            <div className="flex items-center justify-center gap-4 mb-2">
              <a href="/terms" className="hover:text-green-800 transition-colors">Terms of Service</a>
              <span>•</span>
              <a href="/privacy" className="hover:text-green-800 transition-colors">Privacy Policy</a>
              <span>•</span>
              <a href="#" className="hover:text-green-800 transition-colors">Contact Support</a>
            </div>
            <p>© 2025 aggregateDuka. All rights reserved.</p>
          </footer>
        </main>
      </div >

      {/* Floating Add Button - Removed in favor of Header Action */}
      {/* <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 bg-green-600 hover:bg-green-700 text-white p-3 sm:p-4 rounded-full shadow-lg hover:shadow-xl transition-all z-20"
      >
        <Plus size={24} />
      </button> */}

      {/* Add Product Modal */}
      {
        showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] max-w-md w-full p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Add Product</h3>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 mb-4 text-sm text-gray-900"
              />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4 text-sm bg-white text-gray-900"
                disabled={loading}
              >
                <option value="">Select Project (Optional)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
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
        )
      }

      {/* Product Detail Modal */}
      {
        showDetailModal && selectedProduct && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[2rem] max-w-5xl w-full shadow-xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 sm:p-8 border-b border-gray-200 flex-none">
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">Product Details</h3>
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

              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="grid md:grid-cols-2 gap-6 h-full">
                  {/* Product Image Column */}
                  <div className="flex flex-col gap-4">
                    {selectedProduct.imageUrl && (
                      <div className="w-full aspect-square bg-white rounded-lg border border-gray-100 flex items-center justify-center p-4">
                        <img
                          src={selectedProduct.imageUrl}
                          alt={selectedProduct.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    {/* Desktop Actions - Moved here for better layout balance */}
                    <div className="hidden md:flex gap-3">
                      <a
                        href={selectedProduct.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-center px-4 py-3 rounded-lg font-medium transition-colors"
                      >
                        Buy on Carrefour →
                      </a>
                    </div>
                  </div>

                  {/* Product Info Column */}
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 leading-tight">{selectedProduct.name}</h4>
                      <p className="text-sm text-gray-500">SKU: {selectedProduct.sku}</p>
                    </div>

                    {/* Price Section */}
                    <div className="bg-gray-50 rounded-xl p-5 space-y-4 border border-gray-100">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Current Price</p>
                          <p className={`text-4xl font-bold ${isBelowThreshold(selectedProduct.currentPrice || 0, selectedProduct.originalPrice || selectedProduct.retailPrice)
                            ? 'text-green-600'
                            : 'text-gray-900'
                            }`}>
                            KES {selectedProduct.currentPrice?.toLocaleString() || 'N/A'}
                          </p>
                        </div>

                        {selectedProduct.originalPrice && selectedProduct.originalPrice > (selectedProduct.currentPrice || 0) && (
                          <div className="ml-auto text-right">
                            <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Original Price</p>
                            <p className="text-xl text-gray-400 line-through font-medium">
                              KES {selectedProduct.originalPrice.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {selectedProduct.originalPrice && selectedProduct.currentPrice && selectedProduct.originalPrice > selectedProduct.currentPrice ? (
                        <div className="flex items-center gap-2 text-green-700 bg-green-100 px-3 py-2 rounded-lg text-sm font-bold">
                          <TrendingDown size={16} />
                          Save {Math.round((selectedProduct.originalPrice - selectedProduct.currentPrice) / selectedProduct.originalPrice * 100)}%
                          (KES {(selectedProduct.originalPrice - selectedProduct.currentPrice).toLocaleString()})
                        </div>
                      ) : (
                        // Last Offer Price Logic
                        (() => {
                          const lastOffer = selectedProduct.priceHistory.find(h => h.price < (selectedProduct.currentPrice || 0));
                          if (lastOffer) {
                            return (
                              <div className="flex items-center gap-2 text-gray-600 bg-gray-100 px-3 py-2 rounded-lg text-sm font-medium">
                                <Clock size={16} />
                                <span>Last offer: <strong>KES {lastOffer.price.toLocaleString()}</strong> ({lastOffer.date.split(',')[0]})</span>
                              </div>
                            );
                          }
                          return null;
                        })()
                      )}
                    </div>

                    {/* Price History */}
                    {selectedProduct.priceHistory.length > 1 && (
                      <div>
                        <h5 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <Clock size={16} />
                          Price History
                        </h5>
                        <div className="bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                          {selectedProduct.priceHistory.slice(0, 10).map((h, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 border-b border-gray-100 last:border-0 text-sm hover:bg-gray-50">
                              <span className="text-gray-600">{h.date}</span>
                              <span className="font-medium text-gray-900">KES {h.price.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Last Updated */}
                    <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
                      <Clock size={14} />
                      <span>Last updated {getRelativeTime(selectedProduct.lastUpdated)}</span>
                    </div>

                    {/* Project Assignment */}
                    <div className="pt-4 border-t border-gray-100">
                      <h5 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <Package size={16} />
                        Project
                      </h5>
                      <div className="flex gap-2">
                        <select
                          value={selectedProduct.projectId || ''}
                          onChange={(e) => {
                            const newProjectId = e.target.value;
                            const updatedItem = { ...selectedProduct, projectId: newProjectId || undefined };
                            setSelectedProduct(updatedItem);
                            setTrackedItems(prev => prev.map(item =>
                              item.id === selectedProduct.id ? updatedItem : item
                            ));
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900 bg-white"
                        >
                          <option value="">No Project</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowProjectModal(true)}
                          className="px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                          title="Create New Project"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Actions */}
                    <div className="flex md:hidden gap-3 pt-2">
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
            </div>
          </div>
        )
      }
      {/* Add Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] max-w-md w-full p-6 sm:p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Create Project</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                <input
                  type="text"
                  placeholder="e.g. Electronics, Groceries"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Personal, Work"
                  value={newProjectCategory}
                  onChange={(e) => setNewProjectCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm text-gray-900"
                />
              </div>
              <button
                onClick={addProject}
                disabled={!newProjectName.trim()}
                className="w-full bg-[#064e3b] hover:bg-[#065f46] text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Savings Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Set Savings Target</h3>
              <button
                onClick={() => setShowTargetModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Enter your savings goal to visualize it on the chart.</p>
            <input
              type="number"
              placeholder="e.g. 5000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4 text-sm text-gray-900"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setTargetSavings(null);
                  localStorage.removeItem('targetSavings');
                  setShowTargetModal(false);
                }}
                className="flex-1 px-4 py-3 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(targetInput);
                  if (!isNaN(val) && val > 0) {
                    setTargetSavings(val);
                    setShowTargetModal(false);
                  }
                }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-3 font-medium transition-colors text-sm"
              >
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
