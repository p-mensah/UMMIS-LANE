import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Package, ShoppingCart, Truck, LogOut, FileText, 
  Settings as SettingsIcon, Users as UsersIcon, CreditCard, Clock, 
  UserCheck, Tag, Inbox, ArrowLeftRight, ShieldCheck, RotateCcw,
  Store, Sparkles, Building2, Wallet,
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Flat & Standalone Navigation Links (No category sections)
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
    if (path === '/shifts') return 'Shift Register & Cash Drawer Reconciliation';
    if (path === '/purchases') return 'Purchase Orders & Supplier Restocks';
    if (path === '/categories') return 'Product Categories & Departments';
    if (path === '/suppliers') return 'Suppliers & Vendor Directory';
    if (path === '/adjustments') return 'Stock Take & Inventory Adjustments';
    if (path === '/expenses') return 'Business Operating Expenses';
    if (path === '/transactions') return 'Financial Transaction Audit Stream';
    if (path === '/customers') return 'Customer Accounts & Store Debtors';
    if (path === '/users') return 'Staff & User Account Management';
    if (path === '/audit-logs') return 'Security Audit Trail & Override Logs';
    if (path === '/settings') return 'Store Setup & System Configuration';
    return 'Store Operations';
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900 overflow-hidden">
      {/* Reorganized Admin Sidebar */}
      <aside className="w-[240px] bg-slate-900 text-slate-100 border-r border-slate-800 flex flex-col shrink-0 z-20 shadow-xl">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Store size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs font-black uppercase tracking-widest text-white truncate flex items-center gap-1">
                Ummis Lane
                <Sparkles size={11} className="text-pink-400 shrink-0" />
              </h1>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wide">Retail OS • Cloud POS</p>
            </div>
          </div>
        </div>

        {/* Flat Standalone Navigation List */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  }`
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="shrink-0 transition-transform group-hover:scale-110">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[9px] font-black rounded-md uppercase">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/70 text-xs">
          <div className="flex items-center justify-between gap-2 p-2 bg-slate-900/90 rounded-xl border border-slate-800/80 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-900/60 border border-indigo-700/50 text-indigo-200 font-black text-xs flex items-center justify-center uppercase shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-100 truncate text-[11px]">{user?.name}</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] text-slate-400 uppercase font-black tracking-wider">
                    {user?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-xl font-bold text-xs border border-rose-500/20 transition-all hover:border-rose-500/40"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header Bar */}
        <header className="h-[60px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0 shadow-2xs">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ummis Lane Ent. /
            </span>
            <h2 className="text-sm font-black text-slate-900 tracking-tight leading-none mt-0.5">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Date Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px] font-bold border border-slate-200">
              <Clock size={13} className="text-indigo-600" />
              <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>

            {/* Notification Bell */}
            <NotificationBell />
          </div>
        </header>

        {/* Page Body Viewport */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
