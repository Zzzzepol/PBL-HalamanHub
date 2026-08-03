import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="bg-brand-900 text-white mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <img src="/logo.jpg" alt="Mapili_Plant" className="h-10 w-10 rounded-xl object-cover flex-shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold text-lg leading-tight text-white">Mapili</span>
              <span className="text-xs text-brand-300 font-medium tracking-wide">Plant Nursery</span>
            </div>
          </div>
          <p className="text-brand-300 text-sm leading-relaxed max-w-xs">
            We care for healthy, beautiful plants and flowers using smart irrigation and thoughtful nursery practices.
            Delivered fresh for your home, garden, and growing space.
          </p>
          <div className="flex gap-3 mt-4">
            {['ti-brand-facebook', 'ti-brand-instagram', 'ti-brand-tiktok'].map(icon => (
              <button key={icon} className="w-9 h-9 bg-brand-800 hover:bg-brand-600 rounded-lg flex items-center justify-center transition-colors" aria-label={icon.replace('ti-brand-', '')}>
                <i className={`ti ${icon} text-sm`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {/* Shop */}
        <div>
          <div className="font-semibold text-sm uppercase tracking-wider text-brand-300 mb-3">Shop</div>
          <div className="flex flex-col gap-2">
            {[
              { to: '/shop',          label: 'All products' },
              { to: '/cart',          label: 'Your cart' },
            ].map(link => (
              <Link key={link.to} to={link.to} className="text-sm text-brand-300 hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Account */}
        <div>
          <div className="font-semibold text-sm uppercase tracking-wider text-brand-300 mb-3">Account</div>
          <div className="flex flex-col gap-2">
            {[
              { to: '/login',          label: 'Sign in' },
              { to: '/register',       label: 'Create account' },
              { to: '/account/orders', label: 'Order history' },
            ].map(link => (
              <Link key={link.to} to={link.to} className="text-sm text-brand-300 hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-brand-800 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-brand-400">© {new Date().getFullYear()} Mapili Plant Nursery. All rights reserved.</p>
        <div className="flex items-center gap-2 text-xs text-brand-400">
          <i className="ti ti-shield-check text-brand-500" aria-hidden="true" />
          Secure checkout by PayMongo
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
