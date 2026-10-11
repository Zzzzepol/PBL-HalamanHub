import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { path: '/', label: 'Home', icon: 'ti-home' },
  { section: 'My Plants' },
  { path: '/sensors', label: 'Sensors', icon: 'ti-radar' },
  { path: '/irrigation', label: 'Watering', icon: 'ti-droplet' },
  { path: '/rainwater', label: 'Rain tank', icon: 'ti-cloud-rain' },
  { path: '/analytics', label: 'History and trends', icon: 'ti-chart-line' },
  { section: 'Shop' },
  { path: '/products', label: 'Products', icon: 'ti-package' },
  { path: '/orders', label: 'Orders', icon: 'ti-shopping-cart' },
  { path: '/pos', label: 'Walk-in sale', icon: 'ti-basket' },
  { path: '/schedule', label: 'Pickup schedule', icon: 'ti-calendar' },
  { path: '/sales-analytics', label: 'Sales history', icon: 'ti-chart-bar' },
  { section: 'Manage' },
  { path: '/reports', label: 'Reports', icon: 'ti-file-analytics' },
  { path: '/users', label: 'Users', icon: 'ti-users', adminOnly: true },
  { path: '/settings', label: 'Settings', icon: 'ti-settings', adminOnly: true },
  { path: '/logs', label: 'Activity history', icon: 'ti-clipboard-list', adminOnly: true },
];

const Sidebar = ({ mobileOpen, pendingOrders, onNavigate }) => {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isOfflineOnly = user?.role === 'offline-readonly';
  // The offline account stays outside MainLayout. Keep this defensive fallback.
  const visibleItems = isOfflineOnly ? [] : navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className={`flex h-screen w-sidebar flex-shrink-0 flex-col sticky top-0 overflow-hidden z-20 bg-bg-primary border-r border-border max-md:fixed max-md:left-0 max-md:top-0 max-md:z-[100] max-md:h-screen max-md:shadow-lg max-md:transition-transform ${mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}`} aria-label="Main navigation">
      <div className="border-b border-border px-3 py-4">
        <div className="flex min-h-11 items-center gap-3">
          <img src="/logo.jpg" alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
          <span className="text-sm font-semibold leading-tight text-text-primary">Mapili Plant Nursery</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {visibleItems.map(item => {
          if (item.section) return <div key={item.section} className="px-2 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">{item.section}</div>;
          const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          const badge = item.path === '/orders' ? pendingOrders : null;
          return <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={onNavigate} className={`relative mb-1 flex min-h-11 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-base no-underline transition-colors ${active ? 'bg-green-50 font-semibold text-green-800 [&_.ti]:text-green-800' : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}`}>
            <i className={`ti ${item.icon} w-5 flex-shrink-0 text-center text-base`} aria-hidden="true" />
            <span className="flex-1 overflow-hidden text-ellipsis">{item.label}</span>
            {Number(badge) > 0 && <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{badge}</span>}
          </NavLink>;
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-border px-2 pt-2 pb-4">
        <div className="flex items-center gap-2 px-2.5 pt-2 text-xs text-text-secondary"><i className="ti ti-map-pin" aria-hidden="true" /><span>Talisay, Batangas</span></div>
      </div>
    </aside>
  );
};

export default Sidebar;
