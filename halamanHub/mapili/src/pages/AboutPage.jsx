import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/UI';

const AboutPage = () => (
  <div className="min-h-screen bg-white">
    {/* Hero */}
    <section className="hero-gradient text-white py-20 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">About Mapili Plant Nursery</h1>
        <p className="text-brand-100 text-lg leading-relaxed">
          We're a family-run plant nursery using smart IoT technology to grow the freshest, most nutritious produce for our community.
        </p>
      </div>
    </section>

    {/* Story */}
    <section className="py-16 px-4 max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-brand-600 text-sm font-semibold uppercase tracking-wider mb-2">Our story</div>
          <h2 className="font-display text-3xl font-bold text-gray-800 mb-4">Growing smarter, farming better</h2>
          <p className="text-gray-500 leading-relaxed mb-4">
            Mapili Plant Nursery was founded with a simple mission: bring the freshest, locally grown plants and produce to our community — using technology to do it better.
          </p>
          <p className="text-gray-500 leading-relaxed mb-4">
            Our farm uses an IoT-powered smart irrigation system that monitors soil moisture, pH, nutrients, and temperature in real time. This means every plant gets exactly what it needs, exactly when it needs it.
          </p>
          <p className="text-gray-500 leading-relaxed">
            From seed to doorstep, we care about quality, sustainability, and the health of our community.
          </p>
        </div>
        <div className="bg-brand-50 rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-4">
          <i className="ti ti-plant text-7xl text-brand-400" aria-hidden="true" />
          <p className="font-display text-2xl font-bold text-brand-800">From our farm to your table</p>
        </div>
      </div>
    </section>

    {/* Values */}
    <section className="py-16 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-brand-600 text-sm font-semibold uppercase tracking-wider mb-2">What we stand for</div>
          <h2 className="font-display text-3xl font-bold text-gray-800">Our values</h2>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { icon: 'ti-leaf',           title: 'Organic first',       desc: 'We never use harmful pesticides. Our produce is grown naturally, the way nature intended.' },
            { icon: 'ti-device-analytics',title: 'Smart farming',      desc: 'Our IoT sensors monitor every plant 24/7, ensuring optimal growing conditions at all times.' },
            { icon: 'ti-heart',           title: 'Community focused',  desc: "We grow for our community. Local, fresh, and affordable — that's our promise to you." },
            { icon: 'ti-droplet',         title: 'Water efficient',    desc: 'Smart irrigation means we use only the water each plant needs — reducing waste significantly.' },
            { icon: 'ti-truck-delivery',  title: 'Fast fulfillment',   desc: 'Order today, get it tomorrow. Same-day delivery available within our service area.' },
            { icon: 'ti-star',            title: 'Quality guaranteed', desc: "Every order is inspected before packing. We only send out what we'd eat ourselves." },
          ].map((v, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-soft border border-gray-100">
              <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
                <i className={`ti ${v.icon} text-2xl text-brand-600`} aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">{v.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20 px-4 text-center">
      <h2 className="font-display text-3xl font-bold text-gray-800 mb-4">Ready to taste the difference?</h2>
      <p className="text-gray-500 mb-8 text-lg">Browse our fresh products and place your first order today.</p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link to="/shop"><Button variant="primary" size="lg" icon="ti-shopping-bag">Shop now</Button></Link>
        <Link to="/register"><Button variant="outline" size="lg" icon="ti-user-plus">Create account</Button></Link>
      </div>
    </section>
  </div>
);

export default AboutPage;
