import React from 'react';
import { useAuth, User } from '../context/AuthContext';

export type UserRole = 'admin' | 'staff' | 'supplier';

export type AppModule = 
  | 'dashboard'
  | 'sales'
  | 'returns'
  | 'shifts'
  | 'products'
  | 'categories'
  | 'customers'
  | 'communication'
  | 'purchases'
  | 'adjustments'
  | 'suppliers'
  | 'expenses'
  | 'transactions'
  | 'users'
  | 'audit_logs'
  | 'settings'
  | 'reports'
  | 'supplier_dashboard';

export type AppAction =
  | 'manage_users'
  | 'edit_settings'
  | 'view_audit_logs'
  | 'manage_inventory_adjustments'
  | 'create_purchase_order'
  | 'view_financial_reports'
  | 'manage_suppliers'
  | 'view_profit_margins'
  | 'edit_product'
  | 'delete_product'
  | 'import_products'
  | 'manage_shift_registers'
  | 'process_sales'
  | 'process_returns'
  | 'view_product_catalog'
  | 'view_customers'
  | 'open_close_own_shift'
  | 'use_communication';

// Administrative routes that must be strictly hidden/blocked from 'staff' users
export const ADMIN_RESTRICTED_ROUTES = [
  '/adjustments',
  '/inventory',
  '/purchases',
  '/suppliers',
  '/expenses',
  '/transactions',
  '/users',
  '/audit-logs',
  '/settings',
  '/reports',
  '/tablet-inventory',
  '/tablet-mode'
];

// Modules restricted to administrators
export const ADMIN_MODULES: AppModule[] = [
  'purchases',
  'adjustments',
  'suppliers',
  'expenses',
  'transactions',
  'users',
  'audit_logs',
  'settings',
  'reports'
];

/**
 * Super Admin check: Owner or lead administrators with super-privileges
 */
export function isSuperAdmin(user?: User | null): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const name = (user.name || '').toLowerCase();
  return (
    email === 'ing.mensah@gmail.com' ||
    email === 'rabbi@ummis.com' ||
    email === 'admin@admin.com' ||
    name.includes('owner') ||
    name.includes('super admin')
  );
}

/**
 * Admin role check (includes superadmins)
 */
export function isAdmin(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || isSuperAdmin(user);
}

/**
 * Staff role check: Cashiers, inventory clerks, store associates
 */
export function isStaff(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'staff';
}

/**
 * Supplier role check: External vendor portal users
 */
export function isSupplier(user?: User | null): boolean {
  if (!user) return false;
  return user.role === 'supplier';
}

/**
 * Checks whether a user can access a specific module
 */
export function canAccessModule(moduleName: AppModule, user?: User | null): boolean {
  if (!user) return false;
  
  // Admins have access to all store modules (except supplier-only portal which is routed separately)
  if (isAdmin(user)) {
    return moduleName !== 'supplier_dashboard';
  }

  // Suppliers are restricted to supplier dashboard and communication
  if (isSupplier(user)) {
    return moduleName === 'supplier_dashboard' || moduleName === 'communication';
  }

  // Staff users: explicitly exclude all administrative modules
  if (isStaff(user)) {
    if (ADMIN_MODULES.includes(moduleName)) {
      return false;
    }

    // Staff allowed modules
    const staffAllowedModules: AppModule[] = [
      'dashboard',
      'sales',
      'returns',
      'shifts',
      'products',
      'categories',
      'customers',
      'communication'
    ];
    return staffAllowedModules.includes(moduleName);
  }

  return false;
}

/**
 * Checks whether a user can access a route path
 */
export function canAccessRoute(pathname: string, user?: User | null): boolean {
  if (!user) return false;

  const normalized = pathname.toLowerCase().split('?')[0].replace(/\/+$/, '') || '/';

  // Supplier portal routes
  if (normalized.startsWith('/supplier')) {
    return isSupplier(user) || isAdmin(user);
  }

  // Check if route is in administrative restricted list
  const isRestricted = ADMIN_RESTRICTED_ROUTES.some(route => 
    normalized === route || normalized.startsWith(`${route}/`)
  );

  if (isRestricted) {
    return isAdmin(user);
  }

  return true;
}

/**
 * Checks whether a user has permission to perform a specific action
 */
export function canPerformAction(action: AppAction, user?: User | null): boolean {
  if (!user) return false;

  // Admin has clearance for all management actions
  if (isAdmin(user)) {
    return true;
  }

  // Staff action matrix
  if (isStaff(user)) {
    switch (action) {
      case 'process_sales':
      case 'process_returns':
      case 'view_product_catalog':
      case 'view_customers':
      case 'open_close_own_shift':
      case 'use_communication':
        return true;
      case 'manage_users':
      case 'edit_settings':
      case 'view_audit_logs':
      case 'manage_inventory_adjustments':
      case 'create_purchase_order':
      case 'view_financial_reports':
      case 'manage_suppliers':
      case 'view_profit_margins':
      case 'edit_product':
      case 'delete_product':
      case 'import_products':
      case 'manage_shift_registers':
      default:
        return false;
    }
  }

  // Supplier action matrix
  if (isSupplier(user)) {
    return action === 'use_communication';
  }

  return false;
}

/**
 * Filters navigation items, stripping out admin-only modules when user is 'staff'
 */
export function filterNavigationForRole<T extends { to: string; adminOnly?: boolean }>(
  items: T[],
  user?: User | null
): T[] {
  if (!user) return [];
  const userIsAdmin = isAdmin(user);

  return items.filter(item => {
    // If flagged adminOnly, reject non-admins
    if (item.adminOnly && !userIsAdmin) {
      return false;
    }

    // Check path-based access
    return canAccessRoute(item.to, user);
  });
}

/**
 * React Hook: usePermissions
 * Provides clean declarative permission checks across components
 */
export function usePermissions() {
  const { user } = useAuth();

  return {
    user,
    role: user?.role as UserRole | undefined,
    isAdmin: isAdmin(user),
    isStaff: isStaff(user),
    isSupplier: isSupplier(user),
    isSuperAdmin: isSuperAdmin(user),
    canAccessModule: (mod: AppModule) => canAccessModule(mod, user),
    canAccessRoute: (path: string) => canAccessRoute(path, user),
    can: (action: AppAction) => canPerformAction(action, user),
    filterNav: <T extends { to: string; adminOnly?: boolean }>(items: T[]) => 
      filterNavigationForRole(items, user),
  };
}

/**
 * Declarative component for Admin-Only UI sections
 */
export function AdminOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isAdmin } = usePermissions();
  return isAdmin ? <>{children}</> : <>{fallback}</>;
}

/**
 * Declarative component for Staff-Only UI sections
 */
export function StaffOnly({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isStaff } = usePermissions();
  return isStaff ? <>{children}</> : <>{fallback}</>;
}

/**
 * Declarative component for Permission-Gated UI sections
 */
export function PermissionGate({
  action,
  module,
  children,
  fallback = null,
}: {
  action?: AppAction;
  module?: AppModule;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, canAccessModule } = usePermissions();

  let hasPermission = true;
  if (module && !canAccessModule(module)) hasPermission = false;
  if (action && !can(action)) hasPermission = false;

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
