import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useApiData } from '../../hooks/useApiData';
import { alertsApi } from '../../api/client';

const formatTime = (iso) => {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
};

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: alerts } = useApiData(token => alertsApi.getAll(token, 5));

  const notifications = (alerts || []).map(a => ({
    id: a._id,
    type: a.type,
    icon: a.icon,
    message: a.message,
    time: formatTime(a.occurredAt),
    read: a.read,
  }));

  return (
    <div className="flex min-h-screen bg-bg-tertiary">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="hidden max-md:block max-md:fixed max-md:inset-0 max-md:bg-black/40 max-md:z-[90] animate-fade-in-only"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} mobileOpen={mobileOpen} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar onMenuToggle={() => setMobileOpen(!mobileOpen)} notifications={notifications} />
        <div className="p-5 pb-8 flex-1 max-md:p-3.5 max-md:pb-7 max-sm:p-2.5 max-sm:pb-6">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
