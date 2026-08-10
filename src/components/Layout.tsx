import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Truck, LogOut, FileText, Settings as SettingsIcon, Users as UsersIcon, CreditCard, Clock, UserCheck, Tag, Inbox, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-[220px] bg-slate-900 text-slate-100 border-r border-slate-700 flex flex-col">
        <div className="p-6 font-extrabold text-[18px] tracking-widest border-b border-slate-800 uppercase">
          Ummis Lane Ent.
        </div>
        
        <nav className="flex-1 mt-5 space-y-0 overflow-y-auto">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/products" icon={<Package size={20} />} label="Products" />
          <NavItem to="/sales" icon={<ShoppingCart size={20} />} label="Sales" />
          <NavItem to="/shifts" icon={<Clock size={20} />} label="Register/Shift" />
          <NavItem to="/customers" icon={<UserCheck size={20} />} label="Customers" />
          {user?.role === 'admin' && (
             <>
               <NavItem to="/purchases" icon={<Truck size={20} />} label="Purchases" />
               <NavItem to="/categories" icon={<Tag size={20} />} label="Categories" />
               <NavItem to="/suppliers" icon={<Inbox size={20} />} label="Suppliers" />
               <NavItem to="/adjustments" icon={<FileText size={20} />} label="Adjustments" />
               <NavItem to="/expenses" icon={<CreditCard size={20} />} label="Expenses" />
                <NavItem to="/transactions" icon={<ArrowLeftRight size={20} />} label="Transactions" />
               <NavItem to="/users" icon={<UsersIcon size={20} />} label="Users" />
               <NavItem to="/settings" icon={<SettingsIcon size={20} />} label="Settings" />
             </>
          )}
        </nav>

        <div className="p-6 border-t border-slate-800 text-[11px] text-slate-500 flex flex-col gap-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-slate-100">{user?.name}</span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-sm uppercase font-bold tracking-wider">{user?.role}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center text-[13px] font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <LogOut size={16} className="mr-2" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shrink-0">
           <div className="text-slate-500 text-sm">
             Business Overview / <span className="text-slate-900 font-semibold">Daily Dashboard</span>
           </div>
           <div className="flex items-center gap-3 text-sm font-semibold">
           </div>
        </header>
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-6 py-[14px] text-[13px] font-medium transition-colors ${
          isActive 
            ? 'bg-blue-500 text-white' 
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`
      }
    >
      <span className="mr-3 opacity-80">{icon}</span>
      {label}
    </NavLink>
  );
}
