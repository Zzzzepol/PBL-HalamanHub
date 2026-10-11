import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useApiData } from '../../hooks/useApiData';
import { alertsApi, ordersApi } from '../../api/client';
import { WeatherProvider } from '../../context/WeatherContext';
import { timeAgo } from '../../utils/timeAgo';

const quickLinks = [
  { to: '/', label: 'Home', icon: 'ti-home' },
  { to: '/sensors', label: 'Sensors', icon: 'ti-radar' },
  { to: '/irrigation', label: 'Watering', icon: 'ti-droplet' },
  { to: '/orders', label: 'Orders', icon: 'ti-shopping-cart' },
];

const MainLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: alerts, refetch: refetchAlerts } = useApiData(token => alertsApi.getAll(token, 5), [], 10000);
  const { data: orderSummary } = useApiData(ordersApi.getSummary, [], 15000);
  const notifications = (alerts || []).map(alert => ({ id: alert._id, type: alert.type, icon: alert.icon, message: alert.message, time: timeAgo(alert.occurredAt), read: alert.read }));

  return (
    <WeatherProvider>
      <div className="flex min-h-screen bg-bg-tertiary">
        {mobileOpen && <button type="button" className="fixed inset-0 z-[90] bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
        <Sidebar mobileOpen={mobileOpen} pendingOrders={orderSummary?.pending} onNavigate={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMenuToggle={() => setMobileOpen(value => !value)} notifications={notifications} onNotificationsChanged={refetchAlerts} />
          <main className="flex-1 p-5 pb-8 max-md:p-4 max-md:pb-24 max-sm:p-3">
            <div className="animate-fade-in"><Outlet /></div>
          </main>
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-[80] hidden grid-cols-5 border-t border-border bg-bg-primary pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.08)] max-md:grid" aria-label="Quick navigation">
          {quickLinks.map(item => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-medium ${isActive ? 'text-green-800' : 'text-text-secondary'}`}><i className={`ti ${item.icon} text-lg`} aria-hidden="true" /><span>{item.label}</span></NavLink>)}
          <button type="button" onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-medium ${mobileOpen ? 'text-green-800' : 'text-text-secondary'}`}><i className="ti ti-menu-2 text-lg" aria-hidden="true" /><span>More</span></button>
        </nav>
      </div>
    </WeatherProvider>
  );
};

export default MainLayout;
