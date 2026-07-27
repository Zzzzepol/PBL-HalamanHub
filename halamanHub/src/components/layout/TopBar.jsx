import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchBar, Avatar } from '../ui/UI';
import { useAuth } from '../../context/AuthContext';
import { alertsApi } from '../../api/client';

const pageTitles = {
  '/':           { title: 'Dashboard',             sub: 'Farm overview & live readings' },
  '/analytics':  { title: 'Analytics',             sub: 'Sensor trends & crop data'     },
  '/sensors':    { title: 'Sensor monitoring',     sub: 'All ESP32 devices & readings'  },
  '/irrigation': { title: 'Irrigation control',   sub: 'Manage zones & schedules'      },
  '/rainwater':  { title: 'Rainwater harvesting',  sub: 'Tank levels & collection data' },
  '/products':   { title: 'Products',              sub: 'Inventory management'          },
  '/orders':     { title: 'Orders',                sub: 'Customer order management'     },
  '/pos':        { title: 'Point of sale',          sub: 'Walk-in customer sales'        },
  '/users':      { title: 'Users',                 sub: 'Account & access management'   },
  '/reports':    { title: 'Reports & export',      sub: 'Generate and download reports' },
  '/settings':   { title: 'Settings',              sub: 'System configuration'          },
};

const notifIconBg = {
  warning: 'bg-amber-50 text-amber-800',
  error:   'bg-red-50 text-red-800',
  ok:      'bg-green-50 text-green-800',
};

// Very small heuristic: if the search text looks like it's about sensors,
// send them to Sensor Monitoring; otherwise Orders (by far the most common
// thing an admin searches for — order number or customer name) is the
// better default landing spot.
const SENSOR_KEYWORDS = ['moisture', 'temp', 'ph', 'ec', 'humid', 'npk', 'nitrogen', 'phosphorus', 'potassium', 'water', 'tank', 'sensor'];

const TopBar = ({ onMenuToggle, notifications = [], onNotificationsChanged }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, token } = useAuth();
  const [search, setSearch] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const page = pageTitles[location.pathname] || pageTitles['/'];
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    const looksLikeSensor = SENSOR_KEYWORDS.some(kw => q.toLowerCase().includes(kw));
    navigate(looksLikeSensor ? '/sensors' : `/orders?q=${encodeURIComponent(q)}`);
  };

  const markOneRead = async (id) => {
    try {
      await alertsApi.markRead(id, token);
      onNotificationsChanged?.();
    } catch {
      // silent — worst case the dot just stays until the next background refresh
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => alertsApi.markRead(n.id, token)));
      onNotificationsChanged?.();
    } catch {
      // silent — same as above
    }
  };

  return (
    <header className="flex items-center gap-3 px-5 py-2.5 border-b-[0.5px] border-border bg-bg-primary sticky top-0 z-10 min-h-[58px] max-md:px-3 max-md:gap-2">
      {/* Mobile menu button */}
      <button
        className="hidden max-md:flex w-9 h-9 rounded-md border-[0.5px] border-border bg-bg-primary items-center justify-center text-text-secondary text-lg flex-shrink-0"
        onClick={onMenuToggle}
        aria-label="Open navigation"
      >
        <i className="ti ti-menu-2" aria-hidden="true" />
      </button>

      {/* Page title */}
      <div className="flex flex-col min-w-0">
        <h1 className="text-lg font-medium text-text-primary leading-tight whitespace-nowrap max-md:text-md">{page.title}</h1>
        <span className="text-xs text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis max-md:hidden">{page.sub}</span>
      </div>

      <div className="flex items-center gap-2.5 ml-auto flex-shrink-0">
        {/* Search */}
        <form className="w-60 max-lg:w-44 max-md:hidden" onSubmit={handleSearchSubmit}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search orders, sensors… (Enter)" />
        </form>

        {/* Notifications */}
        <div className="relative">
          <button
            className="w-9 h-9 border-[0.5px] border-border rounded-md flex items-center justify-center cursor-pointer bg-bg-primary text-text-secondary hover:bg-bg-secondary transition-colors duration-150 relative text-lg"
            onClick={() => setShowNotifs(!showNotifs)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <i className="ti ti-bell" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full border-[1.5px] border-bg-primary" aria-hidden="true" />
            )}
          </button>

          {showNotifs && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-80 max-h-96 overflow-y-auto bg-bg-primary border-[0.5px] border-border rounded-lg shadow-lg z-50" role="dialog" aria-label="Notifications">
              <div className="flex items-center justify-between px-3.5 py-3 border-b-[0.5px] border-border text-base font-medium sticky top-0 bg-bg-primary">
                <span>Notifications</span>
                <div className="flex items-center gap-2.5">
                  {unreadCount > 0 && (
                    <button className="bg-transparent border-none text-primary text-xs cursor-pointer" onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                  <button className="bg-transparent border-none text-text-secondary cursor-pointer text-base flex" onClick={() => setShowNotifs(false)} aria-label="Close">
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {notifications.slice(0, 5).map(n => (
                <button
                  key={n.id}
                  className={`flex gap-2.5 px-3.5 py-2.5 border-b-[0.5px] border-border last:border-b-0 items-start w-full text-left bg-transparent border-x-0 border-t-0 cursor-pointer hover:bg-bg-secondary ${!n.read ? 'bg-bg-secondary/40' : ''}`}
                  onClick={() => !n.read && markOneRead(n.id)}
                >
                  <div className={`w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0 text-sm ${notifIconBg[n.type] || notifIconBg.ok}`}>
                    <i className={`ti ${n.icon}`} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm text-text-primary leading-snug">{n.message}</div>
                    <div className="text-xs text-text-secondary mt-0.5">{n.time}</div>
                  </div>
                </button>
              ))}
              {notifications.length === 0 && (
                <div className="px-3.5 py-6 text-center text-sm text-text-secondary">No notifications yet.</div>
              )}
            </div>
          )}
        </div>

        {/* Avatar / user menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 cursor-pointer px-1.5 py-1 rounded-md hover:bg-bg-secondary transition-colors duration-150 bg-transparent border-none font-sans"
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-haspopup="true"
            aria-expanded={showUserMenu}
          >
            <Avatar initials={user?.name?.split(' ').map(n => n[0]).join('').slice(0,2) || 'AD'} color="#1a6b3a" size={34} />
            <div className="flex flex-col leading-tight text-left max-lg:hidden">
              <span className="text-sm font-medium text-text-primary whitespace-nowrap">{user?.name || 'Juan Manalo'}</span>
              <span className="text-xs text-text-secondary whitespace-nowrap">Administrator</span>
            </div>
            <i className="ti ti-chevron-down text-sm text-text-secondary" aria-hidden="true" />
          </button>

          {showUserMenu && (
            <div className="absolute top-[calc(100%+8px)] right-0 w-[200px] bg-bg-primary border-[0.5px] border-border rounded-lg shadow-lg z-50 overflow-hidden" role="menu">
              <div className="px-3.5 py-3 border-b-[0.5px] border-border flex flex-col gap-0.5">
                <span className="text-sm font-medium text-text-primary">{user?.name || 'Juan Manalo'}</span>
                <span className="text-xs text-text-secondary">@{user?.username || 'admin'}</span>
              </div>
              <button
                className="flex items-center gap-2 w-full px-3.5 py-2.5 bg-transparent border-none text-sm text-red-600 cursor-pointer text-left font-sans hover:bg-red-50"
                onClick={handleLogout}
                role="menuitem"
              >
                <i className="ti ti-logout text-base" aria-hidden="true" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;