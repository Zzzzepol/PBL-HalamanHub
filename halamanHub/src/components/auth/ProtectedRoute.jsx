// HalamanHub — ProtectedRoute
// Redirects to /login if the user is not authenticated.
// Also confines the offline-readonly account to /offline-readings only —
// every other page needs MongoDB-backed data it doesn't have access to.
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-text-secondary text-base">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role === 'offline-readonly' && location.pathname !== '/offline-readings') {
    return <Navigate to="/offline-readings" replace />;
  }

  return children;
};

export default ProtectedRoute;
