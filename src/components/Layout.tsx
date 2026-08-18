import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Truck, LogOut, FileText, 
  Settings as SettingsIcon, Users as UsersIcon, CreditCard, Clock, 
  UserCheck, Tag, Inbox, ArrowLeftRight, ShieldCheck, RotateCcw,
  Store, Building2, Wallet, Menu, X, Lock,
  SlidersHorizontal, UserCog, History, FolderTree, Scale
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

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
  const navItems: NavItemConfig[] = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/sales', icon: <ShoppingCart size={18} />, label: 'Sales Terminal', badge: 'POS' },
    { to: '/returns', icon: <RotateCcw size={18} />, label: 'Returns & Credits' },
    { to: '/shifts', icon: <Clock size={18} />, label: 'Shift Register' },
    { to: '/products', icon: <Package size={18} />, label: 'Products Catalog' },
    { to: '/categories', icon: <FolderTree size={18} />, label: 'Product Categories' },
    { to: '/adjustments', icon: <Scale size={18} />, label: 'Stock Adjustments' },
    { to: '/purchases', icon: <Truck size={18} />, label: 'Purchase Orders', adminOnly: true },
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
    if (path === '/') return 'Executive Dashboard Overview';
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
    <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
      {navItems.map((item) => {
        if (item.adminOnly && user?.role !== 'admin') return null;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
              }`
            }
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 transition-transform group-hover:scale-105">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </div>

            {item.badge && (
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
    <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-xs space-y-2">
      <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg border border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded bg-blue-900/60 border border-blue-700/50 text-blue-200 font-bold text-xs flex items-center justify-center uppercase shrink-0">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-100 truncate text-[11px]">{user?.name}</div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                {user?.role}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLockTerminal}
          className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition"
          title="Lock Terminal (Quick Sign Out)"
        >
          <Lock size={14} />
        </button>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded font-bold text-xs border border-rose-500/20 transition-colors"
      >
        <LogOut size={13} />
        Sign Out
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Desktop Sidebar (Fluid Flex layout) */}
      <aside className="hidden md:flex flex-col w-56 lg:w-64 bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0 z-20 shadow-xl">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Store size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black uppercase tracking-widest text-white truncate">
              UMMIS LANE ENT
            </h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-wide">Enterprise Retail OS</p>
          </div>
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-100">
        {/* Top Header Bar */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 shrink-0 shadow-2xs">
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
          </div>
        </header>

        {/* Page Body Viewport (Fluid & responsive without hardcoded pixel widths) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 2xl:px-10">
          <div className="w-full max-w-[1680px] mx-auto min-w-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
