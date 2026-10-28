import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Truck, LogOut, FileText, 
  Settings as SettingsIcon, Users as UsersIcon, CreditCard, Clock, 
  UserCheck, Tag, Inbox, ArrowLeftRight, ShieldCheck, RotateCcw,
  Store, Building2, Wallet, Menu, X, Lock,
  SlidersHorizontal, UserCog, History, FolderTree, Scale, Search, User,
  MessageSquare, Boxes, Barcode, BarChart3, Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import NotificationBell from './NotificationBell';
import ProfileModal from './ProfileModal';
import Sidebar from './Sidebar';
import GlobalSearchModal from './GlobalSearchModal';
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
    <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs">
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
  const { totalUnread } = useChat();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGlobalSearchModal, setShowGlobalSearchModal] = useState(false);

  // Global keyboard shortcut for search (Cmd+K / Ctrl+K / forward-slash)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setShowGlobalSearchModal(prev => !prev);
      } else if (
        e.key === '/' && 
        document.activeElement?.tagName !== 'INPUT' && 
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.getAttribute('contenteditable') !== 'true'
      ) {
        e.preventDefault();
        setShowGlobalSearchModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-collapse sidebar on tablet viewports (768px – 1024px) to maximize screen real estate
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
        setIsNavCollapsed(true);
      }
    };
    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    return () => window.removeEventListener('resize', handleViewportChange);
  }, []);

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

  // Helper to determine current page title for topbar header
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/supplier/overview') return user?.role === 'supplier' ? 'Supplier Overview' : 'Executive Dashboard Overview';
    if (path === '/supplier/products' || (user?.role === 'supplier' && path.startsWith('/products'))) return 'Products';
    if (path === '/supplier/shipments' || (user?.role === 'supplier' && path === '/purchases')) return 'Shipments';
    if (path === '/supplier/invoices') return 'Invoices';
    if (path === '/communication' || path === '/supplier/messages') return 'Communications';
    if (path === '/reports') return 'Financial Reports & Business Analytics';
    if (path === '/supplier-dashboard') return 'Supplier Portal & Restock Workflow';
    if (path.startsWith('/products/')) return 'Product Intelligence & Ledger';
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

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full bg-slate-100 font-sans text-slate-900 overflow-hidden overscroll-none">
      {/* Dedicated Clean Sidebar Component */}
      <Sidebar
        isNavCollapsed={isNavCollapsed}
        onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onOpenProfile={() => setShowProfileModal(true)}
        onLockTerminal={handleLockTerminal}
        onLogout={handleLogout}
        user={user}
        totalUnread={totalUnread}
      />

      {/* Main Content Area (Fluid flex viewport with auto-fit container) */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-100 relative print:overflow-visible print:h-auto">
        {/* Top Header Bar - Always pinned and accessible */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 flex items-center justify-between px-3 sm:px-5 lg:px-6 shrink-0 shadow-2xs print:hidden">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial mr-2">
            {/* Mobile Hamburger Menu Button */}
            <button
              id="mobile-menu-toggle-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg md:hidden shrink-0 transition-colors cursor-pointer"
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>

            {/* Desktop / Tablet Navigation Rail Toggle Button */}
            <button
              type="button"
              onClick={() => setIsNavCollapsed(!isNavCollapsed)}
              className="hidden md:flex p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg shrink-0 transition-colors cursor-pointer"
              title={isNavCollapsed ? "Expand Navigation Sidebar" : "Collapse to Navigation Rail"}
            >
              <SlidersHorizontal size={17} />
            </button>

            {/* Single Clear Breadcrumb / Header Hierarchy (No Redundancy) */}
            <div className="min-w-0 flex items-center gap-1.5 text-xs sm:text-sm">
              <span className="hidden sm:inline font-bold text-slate-400 shrink-0">Retail OS</span>
              <span className="hidden sm:inline text-slate-300">/</span>
              <h2 className="font-black text-slate-900 tracking-tight truncate leading-tight">
                {getPageTitle()}
              </h2>
            </div>
          </div>

          {/* Responsive Global Search Trigger (Desktop, Tablet, Mobile) */}
          <div className="flex items-center mx-2 sm:mx-3">
            {/* Desktop & Tablet Search Trigger Bar */}
            <button
              type="button"
              onClick={() => setShowGlobalSearchModal(true)}
              className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 border border-slate-200 hover:border-slate-300 rounded-lg text-xs text-slate-500 transition-all cursor-pointer w-44 md:w-56 lg:w-72 shadow-2xs group"
              title="Global search across products, sales, and customers (Cmd+K)"
            >
              <Search size={14} className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
              <span className="truncate font-medium text-slate-500 group-hover:text-slate-800 text-left">Search products, sales, customers...</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-auto text-[10px] font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 shadow-2xs shrink-0">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Search Icon Button */}
            <button
              type="button"
              onClick={() => setShowGlobalSearchModal(true)}
              className="sm:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Search products, sales, customers"
            >
              <Search size={19} />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Security Indicator */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11px] font-medium" title="30-minute inactivity auto-logout protection active for shared retail environment">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>30m Inactivity Lock</span>
            </div>

            {/* Real-time Ticking Digital Clock & Date */}
            <LiveRealtimeClock />

            {/* Team Chat & Communication Trigger */}
            <button
              onClick={() => navigate('/communication')}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title={`Team Communication & Chat (${totalUnread} unread)`}
            >
              <MessageSquare size={18} />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse shadow-xs">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>

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
          className="flex-1 overflow-y-auto overscroll-contain overscroll-y-contain px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:px-10 custom-scrollbar print:overflow-visible print:p-0 print:m-0"
        >
          <div className="w-full max-w-[1680px] mx-auto min-w-0 print:max-w-none print:w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Profile Management Modal (Accessible to every role: Admin, Staff, Supplier) */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Global Command Palette / Search Modal (Products, Sales, Customers) */}
      <GlobalSearchModal
        isOpen={showGlobalSearchModal}
        onClose={() => setShowGlobalSearchModal(false)}
      />
    </div>
  );
}
