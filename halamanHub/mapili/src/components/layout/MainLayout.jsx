import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const MainLayout = () => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-1 pt-16">
      <div className="page-enter">
        <Outlet />
      </div>
    </main>
    <Footer />
  </div>
);

export default MainLayout;
