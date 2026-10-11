import React, { useState, useMemo } from 'react';
import { Card, CardBody, CardHeader, Table, Badge, Button, SearchBar, FormField, Input, Select, ConfirmDialog, EmptyState, ErrorState } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { plantProfilesApi, productsApi } from '../api/client';
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES } from '../constants/plantCategories';
import * as ps from './pageStyles';

const statusBadge = {
  'in-stock':     { variant: 'ok',    label: 'In stock', icon: 'ti-circle-check' },
  'low-stock':    { variant: 'warning', label: 'Low stock', icon: 'ti-alert-triangle' },
  'out-of-stock': { variant: 'error', label: 'Out of stock', icon: 'ti-circle-x' },
};

// FIXED: Default unit changed to 'bundle' to align with your dropdown options
const emptyForm = { name: '', category: DEFAULT_PRODUCT_CATEGORY, price: '', unit: 'bundle', stock: '', imageUrl: '' };
const normalizePlantPart = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const plantIdentityKey = (name, category) => `${normalizePlantPart(category)}::${normalizePlantPart(name)}`;

const ProductsPage = () => {
  const { token } = useAuth();
  const { data: products, loading, error, refetch, setData: setProducts } = useApiData(productsApi.getAll, [], 15000);
  const { data: plantProfiles, loading: profilesLoading, error: profilesError, refetch: refetchProfiles } = useApiData(plantProfilesApi.getAll, [], 60000, 'products-local-plant-profiles');

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sourceProfile, setSourceProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [notice, setNotice] = useState('');

  const list = useMemo(() => products || [], [products]);

  const filtered = useMemo(
    () => list.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())),
    [list, search]
  );

  const profilesNotInInventory = useMemo(() => {
    if (!products || !plantProfiles) return [];
    const productKeys = new Set(list.map(product => plantIdentityKey(product.name, product.category)));
    const linkedProfileIds = new Set(list.map(product => product.sourcePlantProfileId).filter(Boolean));
    return plantProfiles.filter(profile =>
      !linkedProfileIds.has(profile._id)
      && !productKeys.has(plantIdentityKey(profile.name, profile.category))
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [list, products, plantProfiles]);

  const openAdd = () => { 
    setEditing(null); 
    setSourceProfile(null);
    setForm({ ...emptyForm });
    setImagePreview(''); 
    setSaveError(''); 
    setModalOpen(true); 
  };

  const openEdit = (p) => {
    setEditing(p);
    setSourceProfile(null);
    setForm({ name: p.name, category: p.category, price: p.price, unit: p.unit, stock: p.stock, imageUrl: p.imageUrl || '' });
    setImagePreview(p.imageUrl || ''); 
    setSaveError('');
    setModalOpen(true);
  };

  const openPlantListing = (profile) => {
    setEditing(null);
    setSourceProfile(profile);
    setForm({
      name: profile.name,
      category: profile.category || DEFAULT_PRODUCT_CATEGORY,
      price: '',
      unit: 'bundle',
      stock: '',
      imageUrl: profile.imageUrl || '',
    });
    setImagePreview(profile.imageUrl || '');
    setSaveError('');
    setNotice('');
    setModalOpen(true);
  };

  const triggerFileSelect = () => {
    const input = document.getElementById('hidden-file-input');
    if (input) {
      input.value = '';
      input.click();
    }
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
    };

    try {
      if (editing) {
        const updated = await productsApi.update(editing._id, payload, token);
        setProducts(list.map(p => p._id === editing._id ? updated : p));
        setNotice(`${updated.name} was updated in the product inventory.`);
      } else if (sourceProfile) {
        const created = await productsApi.createFromPlantProfile(sourceProfile._id, payload, token);
        setProducts([...list, created]);
        await refetchProfiles({ background: true });
        setNotice(`${created.name} was added to the online shop.`);
      } else {
        const created = await productsApi.create(payload, token);
        setProducts([...list, created]);
        setNotice(`${created.name} was added to the product inventory.`);
      }
      setModalOpen(false);
    } catch (error) {
      setSaveError(error?.status === 409 ? error.message : 'We could not save this product. Check the details and try again.');
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

      {notice && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900" role="status">{notice}</p>}

      {error && (
        <div className="mb-4"><ErrorState title="Products are not loading" description="Check your connection, then try again." onRetry={refetch} /></div>
      )}

      <Card className="mb-4">
        <CardHeader title="Local plants not in product inventory" subtitle="Set a shop image, price, and stock before adding a local plant to the online shop." />
        <CardBody>
          {profilesError ? (
            <ErrorState title="Local plants are not loading" description="Your product inventory still works. Check the local database, then try again." onRetry={refetchProfiles} />
          ) : loading || profilesLoading ? (
            <p className="py-3 text-sm text-text-secondary" role="status">Checking saved plants against the online inventory…</p>
          ) : error ? (
            <p className="py-3 text-sm text-text-secondary">Reconnect to the online product inventory to check which plants are already listed.</p>
          ) : profilesNotInInventory.length ? (
            <div className="divide-y divide-border rounded-lg border border-border">
              {profilesNotInInventory.map(profile => (
                <div key={profile._id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {profile.imageUrl ? <img src={profile.imageUrl} alt="" className="h-11 w-11 rounded-lg border border-border object-cover" /> : <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-800"><i className="ti ti-plant-2" aria-hidden="true" /></span>}
                    <div className="min-w-0"><p className="truncate font-medium text-text-primary">{profile.name}</p><p className="text-sm text-text-secondary">{profile.category}</p></div>
                  </div>
                  <Button variant="primary" size="sm" onClick={() => openPlantListing(profile)} icon="ti-cloud-upload">Set up shop listing</Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="ti-circle-check" title="All local plants are in the inventory" description={plantProfiles?.length ? 'Every saved local plant already has a matching shop product.' : 'Save a plant profile first. It will appear here when it is not already in the shop.'} />
          )}
        </CardBody>
      </Card>

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
              <span className={ps.modalTitle} id="product-modal-title">{editing ? 'Edit product' : sourceProfile ? 'Set up online product' : 'Add product'}</span>
              <button className={ps.modalClose} onClick={() => setModalOpen(false)} aria-label="Close"><i className="ti ti-x" aria-hidden="true" /></button>
            </div>
            <form onSubmit={saveProduct}>
              <div className={ps.modalBody}>
                {sourceProfile && <p className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900">This plant is saved for local monitoring. Add its shop details below to list it for customers.</p>}
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
                      {!PRODUCT_CATEGORIES.includes(form.category) && <option>{form.category}</option>}
                      {PRODUCT_CATEGORIES.map(category => <option key={category}>{category}</option>)}
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
                  {saving ? 'Saving…' : editing ? 'Save changes' : sourceProfile ? 'Add to online shop' : 'Add product'}
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
