import React, { useState, useMemo } from 'react';
import { Card, CardHeader, Table, Badge, Button, SearchBar, FormField, Input, Select } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { productsApi, ApiError } from '../api/client';
import * as ps from './pageStyles';

const statusBadge = {
  'in-stock':     { variant: 'ok',    label: 'In stock' },
  'low-stock':    { variant: 'warning', label: 'Low stock' },
  'out-of-stock': { variant: 'error', label: 'Out of stock' },
};

// FIXED: Default unit changed to 'bundle' to align with your dropdown options
const emptyForm = { name: '', category: 'Grafted Fruit Bearing Trees', price: '', unit: 'bundle', stock: '', imageUrl: '' };

const ProductsPage = () => {
  const { token } = useAuth();
  const { data: products, loading, error, refetch, setData: setProducts } = useApiData(productsApi.getAll);

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  const list = useMemo(() => products || [], [products]);

  const filtered = useMemo(
    () => list.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())),
    [list, search]
  );

  const openAdd = () => { 
    setEditing(null); 
    setForm(emptyForm); 
    setImagePreview(''); 
    setSaveError(''); 
    setModalOpen(true); 
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category, price: p.price, unit: p.unit, stock: p.stock, imageUrl: p.imageUrl || '' });
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

  const deleteProduct = async (id) => {
    try {
      await productsApi.delete(id, token);
      setProducts(list.filter(p => p._id !== id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Failed to delete product.');
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    const payload = { ...form, price: Number(form.price), stock: Number(form.stock) };
    try {
      if (editing) {
        const updated = await productsApi.update(editing._id, payload, token);
        setProducts(list.map(p => p._id === editing._id ? updated : p));
      } else {
        const created = await productsApi.create(payload, token);
        setProducts([...list, created]);
      }
      setModalOpen(false);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save product.');
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
        <div className="mb-3.5 text-sm text-red-800 bg-red-50 rounded-md px-3 py-2.5">
          Failed to load products. {error instanceof ApiError ? error.message : 'Check that the backend and MongoDB are running.'}{' '}
          <button className="underline" onClick={refetch}>Retry</button>
        </div>
      )}

      {/* Table */}
      <Card className={ps.lastCard}>
        <CardHeader title="Product inventory" subtitle={loading ? 'Loading…' : `${filtered.length} of ${list.length} products`} />
        <Table headers={['Name', 'Category', 'Price', 'Stock', 'Status', 'Actions']}>
          {filtered.map(p => {
            const badge = statusBadge[p.status] || statusBadge['in-stock'];
            return (
              <tr key={p._id}>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>₱{p.price}/{p.unit}</td>
                <td>{p.stock} {p.unit}{p.stock !== 1 ? (p.unit === 'kg' || p.unit === 'bundle' ? '' : 's') : ''}</td>
                <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                <td>
                  <div className={ps.actionBtns}>
                    <Button size="sm" icon="ti-edit" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} />
                    <Button size="sm" icon="ti-trash" onClick={() => deleteProduct(p._id)} aria-label={`Delete ${p.name}`} />
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
        </Table>
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
    </div>
  );
};

export default ProductsPage;