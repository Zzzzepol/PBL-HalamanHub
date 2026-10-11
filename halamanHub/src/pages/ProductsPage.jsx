import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, Button, SearchBar, FormField, Input, Select, ConfirmDialog, EmptyState, ErrorState } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { productsApi } from '../api/client';
import * as ps from './pageStyles';

const statusBadge = {
  'in-stock':     { variant: 'ok',    label: 'In stock', icon: 'ti-circle-check' },
  'low-stock':    { variant: 'warning', label: 'Low stock', icon: 'ti-alert-triangle' },
  'out-of-stock': { variant: 'error', label: 'Out of stock', icon: 'ti-circle-x' },
};

const emptySoilTargets = {
  useDefault: true,
  npk: { nitrogen: '', phosphorus: '', potassium: '' },
  ec: '',
  ph: '',
};

// FIXED: Default unit changed to 'bundle' to align with your dropdown options
const emptyForm = { name: '', category: 'Grafted Fruit Bearing Trees', price: '', unit: 'bundle', stock: '', imageUrl: '', soilTargets: emptySoilTargets };

const ProductsPage = () => {
  const { token } = useAuth();
  const { data: products, loading, error, refetch, setData: setProducts } = useApiData(productsApi.getAll, [], 15000);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const list = useMemo(() => products || [], [products]);

  const filtered = useMemo(
    () => list.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())),
    [list, search]
  );

  const openAdd = () => { 
    setEditing(null); 
    setForm({ ...emptyForm, soilTargets: { ...emptySoilTargets, npk: { ...emptySoilTargets.npk } } }); 
    setImagePreview(''); 
    setSaveError(''); 
    setModalOpen(true); 
  };

  const openEdit = (p) => {
    setEditing(p);
    const nextSoilTargets = {
      useDefault: p.soilTargets?.useDefault ?? true,
      npk: {
        nitrogen: p.soilTargets?.npk?.nitrogen ?? '',
        phosphorus: p.soilTargets?.npk?.phosphorus ?? '',
        potassium: p.soilTargets?.npk?.potassium ?? '',
      },
      ec: p.soilTargets?.ec ?? '',
      ph: p.soilTargets?.ph ?? '',
    };
    setForm({ name: p.name, category: p.category, price: p.price, unit: p.unit, stock: p.stock, imageUrl: p.imageUrl || '', soilTargets: nextSoilTargets });
    setImagePreview(p.imageUrl || ''); 
    setSaveError('');
    setModalOpen(true);
  };

  const triggerFileSelect = () => {
    document.getElementById('hidden-file-input').click();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const localUrl = URL.createObjectURL(file);
      setImagePreview(localUrl);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(prev => ({ ...prev, imageUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteProduct = async () => {
    if (!deleteTarget) return;
    try {
      await productsApi.delete(deleteTarget._id, token);
      setProducts(list.filter(p => p._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch {
      alert('We could not delete this product. Please try again.');
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');

    const payload = {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      soilTargets: {
        useDefault: Boolean(form.soilTargets?.useDefault),
        npk: {
          nitrogen: form.soilTargets?.npk?.nitrogen === '' ? null : Number(form.soilTargets?.npk?.nitrogen),
          phosphorus: form.soilTargets?.npk?.phosphorus === '' ? null : Number(form.soilTargets?.npk?.phosphorus),
          potassium: form.soilTargets?.npk?.potassium === '' ? null : Number(form.soilTargets?.npk?.potassium),
        },
        ec: form.soilTargets?.ec === '' ? null : Number(form.soilTargets?.ec),
        ph: form.soilTargets?.ph === '' ? null : Number(form.soilTargets?.ph),
      },
    };

    try {
      if (editing) {
        const updated = await productsApi.update(editing._id, payload, token);
        setProducts(list.map(p => p._id === editing._id ? updated : p));
      } else {
        const created = await productsApi.create(payload, token);
        setProducts([...list, created]);
      }
      setModalOpen(false);
    } catch {
      setSaveError('We could not save this product. Check the details and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Filters + Add */}
      <div className={ps.filterBar}>
        <div className={ps.filterSearch}>
          <SearchBar value={search} onChange={setSearch} placeholder="Search products by name or category…" />
        </div>
        <Button variant="primary" icon="ti-plus" onClick={openAdd}>Add product</Button>
      </div>

      {error && (
        <div className="mb-4"><ErrorState title="Products are not loading" description="Check your connection, then try again." onRetry={refetch} /></div>
      )}

      {/* Table */}
      <Card className={ps.lastCard}>
        <CardHeader title="Product inventory" subtitle={loading ? 'Loading…' : `${filtered.length} of ${list.length} products`} />
        <div className="hidden xl:block"><Table headers={['Name', 'Category', 'Price', 'Stock', 'Status', 'Actions']}>
          {filtered.map(p => {
            const badge = statusBadge[p.status] || statusBadge['in-stock'];
            return (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>₱{p.price}/{p.unit}</td>
                <td>{p.stock} {p.unit}{p.stock !== 1 ? (p.unit === 'kg' || p.unit === 'bundle' ? '' : 's') : ''}</td>
                <td><Badge variant={badge.variant}><i className={`ti ${badge.icon}`} aria-hidden="true" />{badge.label}</Badge></td>
                <td>
                  <div className={ps.actionBtns}>
                    <Button size="sm" icon="ti-edit" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} />
                    <Button size="sm" icon="ti-trash" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.name}`} />
                  </div>
                </td>
              </tr>
            );
          })}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={6} className="text-center text-text-secondary py-6">
              No products found.
            </td></tr>
          )}
        </Table></div>
        <div className="grid gap-3 p-3 xl:hidden">
          {filtered.map(product => {
            const badge = statusBadge[product.status] || statusBadge['in-stock'];
            return <article key={product._id} className="rounded-xl border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-semibold text-text-primary">{product.name}</h3><p className="text-sm text-text-secondary">{product.category}</p></div><Badge variant={badge.variant}><i className={`ti ${badge.icon}`} aria-hidden="true" />{badge.label}</Badge></div>
              <div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-sm text-text-secondary">Price</p><p className="font-semibold">₱{product.price}/{product.unit}</p></div><div><p className="text-sm text-text-secondary">In stock</p><p className="font-semibold">{product.stock} {product.unit}</p></div></div>
              {product.status === 'low-stock' && <p className="mt-3 text-sm font-medium text-amber-900">Stock is running low. Consider adding more.</p>}
              {product.status === 'out-of-stock' && <p className="mt-3 text-sm font-medium text-red-800">Out of stock. Customers cannot order this yet.</p>}
              <div className="mt-3 flex gap-2"><Button variant="default" icon="ti-edit" onClick={() => openEdit(product)}>Edit product</Button><Button variant="danger" icon="ti-trash" onClick={() => setDeleteTarget(product)}>Delete</Button></div>
            </article>;
          })}
          {!loading && filtered.length === 0 && <EmptyState icon="ti-package" title="No products found" description={search ? 'Try another name or category.' : 'Add your first product to start your shop inventory.'} action={!search ? <Button variant="primary" icon="ti-plus" onClick={openAdd}>Add product</Button> : undefined} />}
        </div>
      </Card>

      {/* Add/Edit modal */}
      {modalOpen && (
        <div className={ps.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={ps.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className={ps.modalHeader}>
              <span className={ps.modalTitle} id="product-modal-title">{editing ? 'Edit product' : 'Add product'}</span>
              <button className={ps.modalClose} onClick={() => setModalOpen(false)} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <form onSubmit={saveProduct}>
              <div className={ps.modalBody}>
                <FormField label="Product image">
                  <input 
                    type="file" 
                    id="hidden-file-input" 
                    accept="image/png, image/jpeg" 
                    style={{ display: 'none' }} 
                    onChange={handleImageChange} 
                  />
                  <div className={ps.uploadBox} onClick={triggerFileSelect} style={{ cursor: 'pointer', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '120px' }}>
                    {imagePreview ? (
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '140px' }} 
                      />
                    ) : (
                      <>
                        <i className="ti ti-photo-up" aria-hidden="true" />
                        <div className={ps.uploadBoxText}>Click to upload or drag and drop<br />PNG, JPG up to 5MB</div>
                      </>
                    )}
                  </div>
                </FormField>
                <div className={`${ps.grid.formRow} mt-3`}>
                  <FormField label="Product name" id="p-name">
                    <Input id="p-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Organic Tomatoes" required />
                  </FormField>
                  <FormField label="Category" id="p-cat">
                    <Select id="p-cat" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                      <option>Grafted Fruit Bearing Trees</option>
                      <option>Forest Trees</option>
                      <option>Bonsai</option>
                      <option>Ornamental Plants</option>
                    </Select>
                  </FormField>
                </div>
                <div className={ps.grid.formRow}>
                  <FormField label="Price (₱)" id="p-price">
                    <Input id="p-price" type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" required />
                  </FormField>
                  <FormField label="Unit" id="p-unit">
                    {/* FIXED: Added value hook and missing onChange listener to track selection */}
                    <Select id="p-unit" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                      <option value="bundle">bundle</option>
                      <option value="piece">piece</option>
                    </Select>
                  </FormField>
                </div>
                <FormField label="Stock quantity" id="p-stock">
                  <Input id="p-stock" type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" required />
                </FormField>

                <details open={!form.soilTargets?.useDefault} className="mt-4 rounded-xl border border-border p-3">
                  <summary className="min-h-11 cursor-pointer py-2 font-medium text-text-primary">Optional soil targets</summary>
                  <div className="pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Soil reading targets</div>
                      <div className="text-xs text-text-secondary">Use the default settings for most plants, or enter your own targets.</div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!form.soilTargets?.useDefault}
                        onChange={(e) => setForm({ ...form, soilTargets: { ...form.soilTargets, useDefault: e.target.checked } })}
                      />
                      <span className="text-sm text-text-secondary">Use default settings</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <FormField label="Plant food level — Nitrogen (N)" id="p-nitrogen">
                      <Input id="p-nitrogen" type="number" value={form.soilTargets?.npk?.nitrogen ?? ''} onChange={e => setForm({ ...form, soilTargets: { ...form.soilTargets, npk: { ...form.soilTargets.npk, nitrogen: e.target.value } } })} placeholder="mg/kg" disabled={form.soilTargets?.useDefault} />
                    </FormField>
                    <FormField label="Plant food level — Phosphorus (P)" id="p-phosphorus">
                      <Input id="p-phosphorus" type="number" value={form.soilTargets?.npk?.phosphorus ?? ''} onChange={e => setForm({ ...form, soilTargets: { ...form.soilTargets, npk: { ...form.soilTargets.npk, phosphorus: e.target.value } } })} placeholder="mg/kg" disabled={form.soilTargets?.useDefault} />
                    </FormField>
                    <FormField label="Plant food level — Potassium (K)" id="p-potassium">
                      <Input id="p-potassium" type="number" value={form.soilTargets?.npk?.potassium ?? ''} onChange={e => setForm({ ...form, soilTargets: { ...form.soilTargets, npk: { ...form.soilTargets.npk, potassium: e.target.value } } })} placeholder="mg/kg" disabled={form.soilTargets?.useDefault} />
                    </FormField>
                    <FormField label="Soil salt level (EC)" id="p-ec">
                      <Input id="p-ec" type="number" value={form.soilTargets?.ec ?? ''} onChange={e => setForm({ ...form, soilTargets: { ...form.soilTargets, ec: e.target.value } })} placeholder="µS/cm" disabled={form.soilTargets?.useDefault} />
                    </FormField>
                    <FormField label="pH target" id="p-ph">
                      <Input id="p-ph" type="number" step="0.1" value={form.soilTargets?.ph ?? ''} onChange={e => setForm({ ...form, soilTargets: { ...form.soilTargets, ph: e.target.value } })} placeholder="6.2" disabled={form.soilTargets?.useDefault} />
                    </FormField>
                  </div>
                  </div>
                </details>

                {saveError && (
                  <div className="mt-3 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">{saveError}</div>
                )}
              </div>
              <div className={ps.modalFooter}>
                <Button variant="default" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog open={Boolean(deleteTarget)} title={`Delete ${deleteTarget?.name || 'this product'}?`} message="Customers will no longer see this product. This action cannot be undone." confirmLabel="Delete product" onConfirm={deleteProduct} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
};

export default ProductsPage;
