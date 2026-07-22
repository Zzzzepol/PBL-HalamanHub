import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer className="bg-brand-900 text-white mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Brand */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="ti ti-plant text-white text-xl" aria-hidden="true" />
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-tight">Mapili Plant Nursery</div>
              <div className="text-xs text-brand-300 tracking-wide">Fresh from our farm to your door</div>
            </div>
          </div>
          <p className="text-brand-300 text-sm leading-relaxed max-w-xs">
            We grow fresh, organic vegetables and plants using IoT-powered smart irrigation. 
            Sustainably farmed, locally delivered.
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
              { to: '/shop?cat=vegetables', label: 'Vegetables' },
              { to: '/shop?cat=leafy', label: 'Leafy greens' },
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
              { to: '/about',          label: 'About us' },
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
          Secure checkout powered by PayMongo
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;
