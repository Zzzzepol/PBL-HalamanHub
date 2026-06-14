import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { section: 'Monitor' },
  { path: '/',label: 'Dashboard',icon: 'ti-dashboard'},
  { path: '/analytics',label: 'Analytics',icon: 'ti-chart-line'},
  { path: '/sensors',label: 'Sensor monitoring',icon: 'ti-radar'},
  { section: 'Control' },
  { path: '/irrigation',label: 'Irrigation control',icon: 'ti-droplet'},
  { path: '/rainwater',label: 'Rainwater harvesting',icon: 'ti-cloud-rain'},
  { section: 'Commerce' },
  { path: '/products',label: 'Products',icon: 'ti-package'},
  { path: '/orders',label: 'Orders', icon: 'ti-shopping-cart', badge: 4 },
  { section: 'Admin' },
  { path: '/users',label: 'Users',icon: 'ti-users'},
  { path: '/reports',label: 'Reports', icon: 'ti-file-analytics' },
  { path: '/settings',label: 'Settings', icon: 'ti-settings'},
  { path: '/logs', label: 'Activity logs', icon: 'ti-clipboard-list' },
];

const Sidebar = ({ collapsed, onToggle, mobileOpen }) => {
  const location = useLocation();

  return (
    <aside
      className={`
        group flex flex-col h-screen sticky top-0 overflow-hidden z-20
        bg-bg-primary border-r-[0.5px] border-border
        transition-[width] duration-[220ms] ease-in-out
        ${collapsed ? 'w-[60px]' : 'w-sidebar'}
        max-md:fixed max-md:left-0 max-md:top-0 max-md:z-[100] max-md:h-screen max-md:shadow-lg
        max-md:transition-transform max-md:duration-[250ms] max-md:ease-in-out
        ${mobileOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}
        ${collapsed ? 'max-md:w-sidebar' : ''}
      `}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3.5 pt-[18px] pb-3.5 border-b-[0.5px] border-border flex-shrink-0 min-h-[64px] relative">
        <div className="w-[34px] h-[34px] bg-green-800 rounded-md flex items-center justify-center flex-shrink-0 text-white text-lg">
          <i className="ti ti-leaf" aria-hidden="true" />
        </div>
        {!collapsed && (
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-md font-semibold text-text-primary whitespace-nowrap">HalamanHub</span>
            <span className="text-xs text-text-secondary whitespace-nowrap">Smart Agriculture</span>
          </div>
        )}
        <button
          className="absolute -right-px top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-bg-primary border-[0.5px] border-border-medium flex items-center justify-center text-text-secondary text-[11px] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <i className={`ti ${collapsed ? 'ti-chevron-right' : 'ti-chevron-left'}`} aria-hidden="true" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-2.5 flex-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item, i) => {
          if (item.section) {
            return !collapsed ? (
              <div key={i} className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider px-2 pt-2.5 pb-1 whitespace-nowrap">
                {item.section}
              </div>
            ) : null;
          }

          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={`
                flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer text-base mb-0.5 whitespace-nowrap relative overflow-hidden no-underline
                transition-colors duration-150
                ${isActive
                  ? 'bg-green-50 text-green-800 font-medium [&_.ti]:text-green-800'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'}
              `}
              title={collapsed ? item.label : undefined}
            >
              <i className={`ti ${item.icon} text-[17px] w-5 text-center flex-shrink-0`} aria-hidden="true" />
              {!collapsed && <span className="flex-1 overflow-hidden text-ellipsis">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="ml-auto bg-red-100 text-red-800 text-[10px] px-[7px] py-0.5 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
              {collapsed && item.badge && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-600 rounded-full text-[8px] text-white flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      {!collapsed && (
        <div className="px-2 pt-2 pb-4 border-t-[0.5px] border-border flex-shrink-0">
          <NavLink
            to="/settings"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md cursor-pointer text-base text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors duration-150 no-underline"
          >
            <i className="ti ti-help-circle text-[17px] w-5 text-center flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 overflow-hidden text-ellipsis">Help & documentation</span>
          </NavLink>
          <div className="flex items-center gap-[5px] text-xs text-text-tertiary px-2.5 pt-1.5">
            <i className="ti ti-map-pin text-[12px]" aria-hidden="true" />
            <span>Talisay, Batangas</span>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
