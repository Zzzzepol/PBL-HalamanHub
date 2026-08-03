import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 group">
    <img src="/logo.jpg" alt="Mapili_Plant" className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
    <div className="flex flex-col leading-none">
      <span className="font-display font-bold text-brand-800 text-lg leading-tight">Mapili</span>
      <span className="text-xs text-brand-600 font-medium tracking-wide">Plant Nursery</span>
    </div>
  </Link>
);

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setUserMenuOpen(false);
  };

  const navLinks = [

  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-soft' : 'bg-white/95 backdrop-blur-sm'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${location.pathname.startsWith(link.to) ? 'text-brand-700 bg-brand-50' : 'text-gray-600 hover:text-brand-700 hover:bg-brand-50'}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link
              to="/cart"
              className="relative flex items-center justify-center w-10 h-10 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label={`Cart, ${itemCount} items`}
            >
              <i className="ti ti-shopping-cart text-xl text-gray-600" aria-hidden="true" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-medium">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
            </Link>

            {/* User menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
                  aria-haspopup="true"
                >
                  <div className="w-7 h-7 bg-brand-700 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">{user?.name}</span>
                  <i className="ti ti-chevron-down text-xs text-gray-400" aria-hidden="true" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-52 bg-white border border-gray-100 rounded-2xl shadow-lift overflow-hidden z-50" role="menu">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-sm font-semibold text-gray-800 truncate">{user?.name}</div>
                      <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                    </div>
                    <Link to="/account" className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setUserMenuOpen(false)} role="menuitem">
                      <i className="ti ti-user text-base" aria-hidden="true" />My account
                    </Link>
                    <Link to="/account/orders" className="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors" onClick={() => setUserMenuOpen(false)} role="menuitem">
                      <i className="ti ti-package text-base" aria-hidden="true" />My orders
                    </Link>
                    <div className="border-t border-gray-100">
                      <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors" role="menuitem">
                        <i className="ti ti-logout text-base" aria-hidden="true" />Log out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-brand-700 transition-colors rounded-xl hover:bg-brand-50">
                  Sign in
                </Link>
                <Link to="/register" className="px-4 py-2 text-sm font-medium bg-brand-700 hover:bg-brand-800 text-white rounded-xl transition-colors">
                  Create account
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <i className={`ti ${mobileOpen ? 'ti-x' : 'ti-menu-2'} text-xl text-gray-600`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-2">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
              {link.label}
            </Link>
          ))}
          {!isAuthenticated && (
            <>
              <Link to="/login"    className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">Sign in</Link>
              <Link to="/register" className="px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-700 text-white hover:bg-brand-800 transition-colors text-center">Create account</Link>
            </>
          )}
          {isAuthenticated && (
            <>
              <Link to="/account"        className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">My account</Link>
              <Link to="/account/orders" className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">My orders</Link>
              <button onClick={handleLogout} className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors text-left">Log out</button>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
