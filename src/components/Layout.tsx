import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Truck, LogOut, FileText, 
  Settings as SettingsIcon, Users as UsersIcon, CreditCard, Clock, 
  UserCheck, Tag, Inbox, ArrowLeftRight, ShieldCheck, RotateCcw,
  Store, Building2, Wallet, Menu, X, Lock,
  SlidersHorizontal, UserCog, History, FolderTree, Scale, Search, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import { fetchApi } from '../lib/api';

interface NavItemConfig {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  adminOnly?: boolean;
}

function LiveRealtimeClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeString = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const dateString = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs">
      <div className="flex items-center gap-1.5 font-mono text-slate-900 font-bold">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{timeString}</span>
      </div>
      <span className="text-slate-300">|</span>
      <span className="text-[11px] text-slate-500 font-medium">{dateString}</span>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ products: any[]; customers: any[]; transactions: any[] }>({ products: [], customers: [], transactions: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Listen to navigation slider events from action menu or page triggers
  useEffect(() => {
    const handleSliderToggle = (e: any) => {
      if (e?.detail?.collapsed !== undefined) {
        setIsNavCollapsed(e.detail.collapsed);
      } else {
        setIsNavCollapsed(prev => !prev);
      }
    };
    window.addEventListener('toggle-nav-slider', handleSliderToggle);
    return () => window.removeEventListener('toggle-nav-slider', handleSliderToggle);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults({ products: [], customers: [], transactions: [] });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [prods, custs, trans] = await Promise.all([
          fetchApi('/products').catch(() => []),
          fetchApi('/customers').catch(() => []),
          fetchApi('/reports/transactions').catch(() => [])
        ]);

        const q = searchQuery.toLowerCase();
        const matchedProds = (Array.isArray(prods) ? prods : []).filter((p: any) => 
          p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q)
        ).slice(0, 5);

        const matchedCusts = (Array.isArray(custs) ? custs : []).filter((c: any) => 
          c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
        ).slice(0, 5);

        const matchedTrans = (Array.isArray(trans) ? trans : []).filter((t: any) => 
          t.id?.toString().includes(q) || t.customer_name?.toLowerCase().includes(q) || t.payment_method?.toLowerCase().includes(q)
        ).slice(0, 5);

        setSearchResults({ products: matchedProds, customers: matchedCusts, transactions: matchedTrans });
        setShowSearchDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLockTerminal = () => {
    try {
      sessionStorage.setItem('umis_session_timeout_msg', 'Terminal locked by user. Please sign in to resume your register session.');
    } catch (e) {}
    logout();
    navigate('/login');
  };

  // Flat & Standalone Navigation Links
  const navItems: NavItemConfig[] = user?.role === 'supplier' ? [
    { to: '/supplier-dashboard', icon: <Building2 size={18} />, label: 'Supplier Portal', badge: 'Vendor' },
    { to: '/purchases', icon: <Truck size={18} />, label: 'Purchase Orders' },
    { to: '/products', icon: <Package size={18} />, label: 'Supplied Products' }
  ] : [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/sales', icon: <ShoppingCart size={18} />, label: 'Sales Terminal', badge: 'POS' },
    { to: '/returns', icon: <RotateCcw size={18} />, label: 'Returns & Credits' },
    { to: '/shifts', icon: <Clock size={18} />, label: 'Shift Register' },
    { to: '/products', icon: <Package size={18} />, label: 'Products Catalog' },
    { to: '/categories', icon: <FolderTree size={18} />, label: 'Product Categories' },
    { to: '/adjustments', icon: <Scale size={18} />, label: 'Stock Adjustments', adminOnly: true },
    { to: '/purchases', icon: <Truck size={18} />, label: 'Purchase Orders', adminOnly: true },
    { to: '/supplier-dashboard', icon: <Building2 size={18} />, label: 'Supplier Portal', adminOnly: true },
    { to: '/suppliers', icon: <Building2 size={18} />, label: 'Suppliers Directory', adminOnly: true },
    { to: '/expenses', icon: <CreditCard size={18} />, label: 'Expenses Ledger', adminOnly: true },
    { to: '/transactions', icon: <ArrowLeftRight size={18} />, label: 'Cash Transactions', adminOnly: true },
    { to: '/customers', icon: <UserCheck size={18} />, label: 'Customers Directory' },
    { to: '/users', icon: <UsersIcon size={18} />, label: 'User Management', adminOnly: true },
    { to: '/audit-logs', icon: <ShieldCheck size={18} />, label: 'Audit Security Logs', adminOnly: true },
    { to: '/settings', icon: <SettingsIcon size={18} />, label: 'Store Settings', adminOnly: true },
  ];

  // Helper to determine current page title for topbar header
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return user?.role === 'supplier' ? 'Supplier Portal Dashboard' : 'Executive Dashboard Overview';
    if (path === '/supplier-dashboard') return 'Supplier Portal & Restock Workflow';
    if (path.startsWith('/products')) return 'Products Catalog & Inventory';
    if (path === '/sales') return 'Point of Sale (POS) Terminal';
    if (path === '/returns') return 'Returns & Credit Notes Ledger';
    if (path === '/shifts') return 'Shift Register & Cash Reconciliation';
    if (path === '/purchases') return 'Purchase Orders & Restocks';
    if (path === '/categories') return 'Product Categories & Departments';
    if (path === '/suppliers') return 'Suppliers & Vendor Directory';
    if (path === '/adjustments') return 'Stock Take & Inventory Adjustments';
    if (path === '/expenses') return 'Business Operating Expenses';
    if (path === '/transactions') return 'Financial Transaction Audit Stream';
    if (path === '/customers') return 'Customer Accounts & Debtors';
    if (path === '/users') return 'Staff & User Account Management';
    if (path === '/audit-logs') return 'Security Audit Trail & Overrides';
    if (path === '/settings') return 'Store Setup & System Configuration';
    return 'Store Operations';
  };

  const renderNavList = () => (
    <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto custom-scrollbar">
      {navItems.map((item) => {
        if (item.adminOnly && user?.role !== 'admin') return null;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileMenuOpen(false)}
            title={isNavCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              `group flex items-center ${isNavCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              }`
            }
          >
            <div className={`flex items-center ${isNavCollapsed ? 'justify-center' : 'gap-2.5'} min-w-0`}>
              <span className="shrink-0 transition-transform group-hover:scale-105">
                {item.icon}
              </span>
              {!isNavCollapsed && <span className="truncate">{item.label}</span>}
            </div>

            {!isNavCollapsed && item.badge && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[9px] font-black rounded uppercase">
                {item.badge}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );

  const renderUserProfileFooter = () => (
    <div className={`p-2.5 border-t border-slate-800 bg-slate-950/70 text-xs ${isNavCollapsed ? 'flex flex-col items-center space-y-2' : 'space-y-2'}`}>
      <div 
        onClick={() => setShowProfileModal(true)}
        className={`flex items-center ${isNavCollapsed ? 'justify-center p-1.5' : 'justify-between gap-2 p-2'} bg-slate-900 hover:bg-slate-850 rounded-lg border border-slate-800 hover:border-slate-700 w-full cursor-pointer transition group`}
        title="Manage Account Profile"
      >
        <div className={`flex items-center ${isNavCollapsed ? 'justify-center' : 'gap-2'} min-w-0`}>
          {user?.profile_picture ? (
            <img 
              src={user.profile_picture} 
              alt={user.name} 
              className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0 group-hover:ring-2 group-hover:ring-blue-500/40" 
            />
          ) : (
            <div className="w-7 h-7 rounded bg-blue-900/60 border border-blue-700/50 text-blue-200 font-bold text-xs flex items-center justify-center uppercase shrink-0 group-hover:border-blue-400">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          {!isNavCollapsed && (
            <div className="min-w-0 text-left">
              <div className="font-bold text-slate-100 truncate text-[11px] group-hover:text-blue-300 transition-colors">{user?.name}</div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                  {user?.role}
                </span>
              </div>
            </div>
          )}
        </div>

        {!isNavCollapsed && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileModal(true);
              }}
              className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-850 rounded transition"
              title="Edit Profile"
            >
              <User size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLockTerminal();
              }}
              className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-850 rounded transition"
              title="Lock Terminal (Quick Sign Out)"
            >
              <Lock size={13} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className={`w-full flex items-center justify-center gap-2 py-1.5 ${isNavCollapsed ? 'px-1' : 'px-3'} bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded font-bold text-xs border border-rose-500/20 transition-colors`}
        title="Sign Out"
      >
        <LogOut size={13} />
        {!isNavCollapsed && <span>Sign Out</span>}
      </button>
    </div>
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full bg-slate-100 font-sans text-slate-900 overflow-hidden overscroll-none">
      {/* Desktop Sidebar (Fluid Flex layout with collapsible Navigation Slider) */}
      <aside className={`hidden md:flex flex-col ${isNavCollapsed ? 'w-16' : 'w-56 lg:w-64'} bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0 z-20 shadow-xl transition-all duration-300 ease-in-out`}>
        {/* Brand Header */}
        <div className={`p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center ${isNavCollapsed ? 'justify-center' : 'justify-between'} gap-2.5`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Store size={16} />
            </div>
            {!isNavCollapsed && (
              <div className="min-w-0">
                <h1 className="text-xs font-black uppercase tracking-widest text-white truncate">
                  UMMIS LANE ENT
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide truncate">Retail OS</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsNavCollapsed(!isNavCollapsed)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition"
            title={isNavCollapsed ? "Expand Navigation Slider" : "Collapse Navigation Slider"}
          >
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* Navigation List */}
        {renderNavList()}

        {/* User Profile Footer */}
        {renderUserProfileFooter()}
      </aside>

      {/* Mobile Drawer (Accessible on small screens) */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex md:hidden animate-in fade-in duration-150"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 max-w-[80vw] h-full bg-slate-900 text-slate-100 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white shrink-0">
                  <Store size={16} />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-white">UMMIS LANE ENT</h2>
                  <p className="text-[10px] text-slate-400">Retail OS</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                title="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {renderNavList()}
            {renderUserProfileFooter()}
          </div>
        </div>
      )}

      {/* Main Content Area (Fluid flex viewport with auto-fit container) */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100 relative">
        {/* Top Header Bar - Always pinned and accessible */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Menu Button */}
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden shrink-0 transition-colors"
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <span className="hidden sm:inline text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                UMMIS LANE ENT /
              </span>
              <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-none truncate mt-0.5">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          {/* Global Search Bar */}
          <div className="relative flex-1 max-w-xs mx-4 hidden md:block" ref={searchRef}>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products, customers, transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchQuery.length >= 2) setShowSearchDropdown(true); }}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-100 focus:bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearchDropdown && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-96 overflow-y-auto z-50 divide-y divide-slate-100">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">Searching records...</div>
                ) : searchResults.products.length === 0 && searchResults.customers.length === 0 && searchResults.transactions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">No results found for "{searchQuery}"</div>
                ) : (
                  <div className="py-2">
                    {/* Products */}
                    {searchResults.products.length > 0 && (
                      <div>
                        <div className="px-3 py-1 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">Products ({searchResults.products.length})</div>
                        {searchResults.products.map((p: any) => (
                          <div 
                            key={`prod-${p.id}`}
                            onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); navigate('/products'); }}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Package size={14} className="text-blue-600 shrink-0" />
                              <span className="font-bold text-slate-900 truncate">{p.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">SKU: {p.sku}</span>
                            </div>
                            <span className="font-black text-blue-600">GH₵{p.selling_price?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Customers */}
                    {searchResults.customers.length > 0 && (
                      <div>
                        <div className="px-3 py-1 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">Customers ({searchResults.customers.length})</div>
                        {searchResults.customers.map((c: any) => (
                          <div 
                            key={`cust-${c.id}`}
                            onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); navigate('/customers'); }}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <UserCheck size={14} className="text-emerald-600 shrink-0" />
                              <span className="font-bold text-slate-900">{c.name}</span>
                              <span className="text-[10px] text-slate-500">{c.phone || c.email}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Transactions */}
                    {searchResults.transactions.length > 0 && (
                      <div>
                        <div className="px-3 py-1 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">Transactions ({searchResults.transactions.length})</div>
                        {searchResults.transactions.map((t: any) => (
                          <div 
                            key={`trans-${t.id}`}
                            onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); navigate('/transactions'); }}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <ArrowLeftRight size={14} className="text-indigo-600 shrink-0" />
                              <span className="font-bold text-slate-900">Sale #{t.id} - {t.customer_name || 'Walk-in'}</span>
                            </div>
                            <span className="font-black text-slate-900">GH₵{t.total?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Security Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-medium" title="30-minute inactivity auto-logout protection active for shared retail environment">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>30m Inactivity Lock</span>
            </div>

            {/* Real-time Ticking Digital Clock & Date */}
            <LiveRealtimeClock />

            {/* In-App Notifications Dropdown */}
            <NotificationBell />

            {/* User Profile Quick Trigger */}
            <button
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs transition"
              title="My Profile & Account Settings"
            >
              {user?.profile_picture ? (
                <img 
                  src={user.profile_picture} 
                  alt={user.name} 
                  className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-300" 
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-800 text-white font-black text-[10px] flex items-center justify-center uppercase shrink-0">
                  {user?.name?.charAt(0) || 'U'}
                </div>
              )}
              <span className="hidden sm:inline font-bold text-slate-800 text-xs truncate max-w-[100px]">
                {user?.name?.split(' ')[0]}
              </span>
            </button>
          </div>
        </header>

        {/* Page Body Viewport (Fluid & responsive without hardcoded pixel widths, scroll contained) */}
        <div 
          id="main-content-scroll" 
          className="flex-1 overflow-y-auto overscroll-contain overscroll-y-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:px-10 custom-scrollbar"
        >
          <div className="w-full max-w-[1680px] mx-auto min-w-0">
            {children}
          </div>
        </div>
      </main>

      {/* Profile Management Modal (Accessible to every role: Admin, Staff, Supplier) */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </div>
  );
}
