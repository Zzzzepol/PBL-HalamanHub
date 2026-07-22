import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

import HomePage          from './pages/HomePage';
import ShopPage          from './pages/ShopPage';
import ProductDetailPage from './pages/ProductDetailPage';
import CartPage          from './pages/CartPage';
import CheckoutPage      from './pages/CheckoutPage';
import OrderSuccessPage  from './pages/OrderSuccessPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import AccountPage       from './pages/AccountPage';
import OrdersPage        from './pages/OrdersPage';
import AboutPage         from './pages/AboutPage';
import OrderPendingPage from './pages/OrderPendingPage';


function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              {/* Public */}
              <Route path="/"           element={<HomePage />} />
              <Route path="/shop"       element={<ShopPage />} />
              <Route path="/shop/:id"   element={<ProductDetailPage />} />
              <Route path="/cart"       element={<CartPage />} />
              <Route path="/about"      element={<AboutPage />} />
              <Route path="/login"      element={<LoginPage />} />
              <Route path="/register"   element={<RegisterPage />} />

              {/* Protected */}
              <Route path="/checkout" element={
                <ProtectedRoute><CheckoutPage /></ProtectedRoute>
              } />
              <Route path="/order-success/:id" element={
                <ProtectedRoute><OrderSuccessPage /></ProtectedRoute>
              } />
              <Route path="/account" element={
                <ProtectedRoute><AccountPage /></ProtectedRoute>
              } />
              <Route path="/account/orders" element={
                <ProtectedRoute><OrdersPage /></ProtectedRoute>
              } />
              <Route path="/order-pending/:id" element={
                <ProtectedRoute><OrderPendingPage /></ProtectedRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
