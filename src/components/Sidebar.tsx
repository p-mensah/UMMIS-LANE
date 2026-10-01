import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Truck,
  CreditCard,
  MessageSquare,
  ShoppingCart,
  RotateCcw,
  Clock,
  FolderTree,
  Scale,
  Building2,
  ArrowLeftRight,
  UserCheck,
  Users as UsersIcon,
  ShieldCheck,
  Settings as SettingsIcon,
  Store,
  SlidersHorizontal,
  User,
  Lock,
  LogOut,
  X
} from 'lucide-react';

export interface NavItemConfig {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  adminOnly?: boolean;
}

interface SidebarProps {
  isNavCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  onOpenProfile: () => void;
  onLockTerminal: () => void;
  onLogout: () => void;
  user: any;
  totalUnread?: number;
}

export default function Sidebar({
  isNavCollapsed,
  onToggleCollapse,
  mobileMenuOpen,
  onCloseMobileMenu,
  onOpenProfile,
  onLockTerminal,
  onLogout,
  user,
  totalUnread = 0,
}: SidebarProps) {
  const location = useLocation();
  const isSupplier = user?.role === 'supplier';

  // MANDATE: Suppliers display ONLY the following 5 navigation links:
  // Overview, Products, Shipments, Invoices, Communications.
  // Strictly NO secondary/hidden navigation items, Quick Action buttons, Procurement, or Analytics sub-menus.
  const supplierNavItems: NavItemConfig[] = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { to: '/supplier/products', icon: <Package size={18} />, label: 'Products' },
    { to: '/supplier/shipments', icon: <Truck size={18} />, label: 'Shipments' },
    { to: '/supplier/invoices', icon: <CreditCard size={18} />, label: 'Invoices' },
    {
      to: '/communication',
      icon: <MessageSquare size={18} />,
      label: 'Communications',
      badge: totalUnread > 0 ? `${totalUnread}` : undefined,
    },
  ];

  // Store Operations Nav Items for Staff & Store Admin
  const standardNavItems: NavItemConfig[] = [
    { to: '/', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/communication', icon: <MessageSquare size={18} />, label: 'Team Communication', badge: totalUnread > 0 ? `${totalUnread}` : undefined },
    { to: '/sales', icon: <ShoppingCart size={18} />, label: 'Sales Terminal', badge: 'POS' },
    { to: '/returns', icon: <RotateCcw size={18} />, label: 'Returns & Credits' },
    { to: '/shifts', icon: <Clock size={18} />, label: 'Shift Register' },
    { to: '/products', icon: <Package size={18} />, label: 'Products Catalog' },
    { to: '/categories', icon: <FolderTree size={18} />, label: 'Product Categories' },
    { to: '/adjustments', icon: <Scale size={18} />, label: 'Stock Adjustments', adminOnly: true },
    { to: '/purchases', icon: <Truck size={18} />, label: 'Purchase Orders', adminOnly: true },
    { to: '/supplier-dashboard', icon: <Truck size={18} />, label: 'Supplier Portal', adminOnly: true },
    { to: '/suppliers', icon: <Building2 size={18} />, label: 'Suppliers Directory', adminOnly: true },
    { to: '/expenses', icon: <CreditCard size={18} />, label: 'Expenses Ledger', adminOnly: true },
    { to: '/transactions', icon: <ArrowLeftRight size={18} />, label: 'Cash Transactions', adminOnly: true },
    { to: '/customers', icon: <UserCheck size={18} />, label: 'Customers Directory' },
    { to: '/users', icon: <UsersIcon size={18} />, label: 'User Management', adminOnly: true },
    { to: '/audit-logs', icon: <ShieldCheck size={18} />, label: 'Audit Security Logs', adminOnly: true },
    { to: '/settings', icon: <SettingsIcon size={18} />, label: 'Store Settings', adminOnly: true },
  ];

  const activeNavItems = isSupplier ? supplierNavItems : standardNavItems;

  const renderNavList = () => (
    <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto custom-scrollbar">
      {activeNavItems.map((item) => {
        if (item.adminOnly && user?.role !== 'admin') return null;

        const isItemActive = item.to === '/'
          ? (location.pathname === '/' || location.pathname === '/supplier/overview' || (isSupplier && location.pathname === '/supplier-dashboard'))
          : (location.pathname === item.to ||
             (item.to === '/supplier/products' && (location.pathname === '/products' || location.pathname === '/supplier/catalog')) ||
             (item.to === '/supplier/shipments' && (location.pathname === '/purchases' || location.pathname === '/supplier/pos')) ||
             (item.to === '/communication' && (location.pathname === '/communication' || location.pathname === '/supplier/messages')));

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onCloseMobileMenu}
            title={isNavCollapsed ? item.label : undefined}
            className={() =>
              `group flex items-center ${isNavCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2 rounded-lg text-xs font-bold transition-all ${
                isItemActive
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
        onClick={onOpenProfile}
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
                onOpenProfile();
              }}
              className="p-1.5 text-slate-400 hover:text-blue-300 hover:bg-slate-850 rounded transition cursor-pointer"
              title="Edit Profile"
            >
              <User size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLockTerminal();
              }}
              className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-850 rounded transition cursor-pointer"
              title="Lock Terminal"
            >
              <Lock size={13} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onLogout}
        className={`w-full flex items-center justify-center gap-2 py-1.5 ${isNavCollapsed ? 'px-1' : 'px-3'} bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded font-bold text-xs border border-rose-500/20 transition-colors cursor-pointer`}
        title="Sign Out"
      >
        <LogOut size={13} />
        {!isNavCollapsed && <span>Sign Out</span>}
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fluid Flex layout with collapsible Navigation Slider) */}
      <aside className={`hidden md:flex flex-col ${isNavCollapsed ? 'w-16' : 'w-56 lg:w-64'} bg-slate-900 text-slate-100 border-r border-slate-800 shrink-0 z-20 shadow-xl transition-all duration-300 ease-in-out print:hidden`}>
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
                <p className="text-[10px] text-slate-400 font-medium tracking-wide truncate">
                  {isSupplier ? 'Supplier Operations Portal' : 'Retail OS'}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition cursor-pointer"
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex md:hidden animate-in fade-in duration-150 print:hidden"
          onClick={onCloseMobileMenu}
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
                  <p className="text-[10px] text-slate-400">
                    {isSupplier ? 'Supplier Operations' : 'Retail OS'}
                  </p>
                </div>
              </div>
              <button
                onClick={onCloseMobileMenu}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
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
    </>
  );
}
