import React, { useMemo, useState } from 'react';
import { Button, Card, CardBody, CardHeader, ConfirmDialog, EmptyState, ErrorState, FormField, Input, Select, StatusBadge } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { plantProfilesApi, productsApi } from '../api/client';
import { DEFAULT_PRODUCT_CATEGORY, PRODUCT_CATEGORIES } from '../constants/plantCategories';

const emptyTargets = () => ({
  useDefault: true,
  npk: { nitrogen: '', phosphorus: '', potassium: '' },
  ec: '',
  ph: '',
});

const emptyForm = () => ({ name: '', category: DEFAULT_PRODUCT_CATEGORY, imageUrl: '', soilTargets: emptyTargets(), keepShopLink: false });

const targetValue = value => value == null ? '' : value;
const normalizePlantPart = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const plantIdentity = (name, category) => `${normalizePlantPart(category)}::${normalizePlantPart(name)}`;
const targetFields = [
  { key: 'nitrogen', group: 'npk', label: 'Plant food — Nitrogen (N)', unit: 'mg/kg' },
  { key: 'phosphorus', group: 'npk', label: 'Plant food — Phosphorus (P)', unit: 'mg/kg' },
  { key: 'potassium', group: 'npk', label: 'Plant food — Potassium (K)', unit: 'mg/kg' },
  { key: 'ec', label: 'Soil salt (EC)', unit: 'µS/cm' },
  { key: 'ph', label: 'Soil acidity (pH)', unit: 'pH' },
];

const PlantProfilesPage = () => {
  const { token } = useAuth();
  const { data: profiles, loading, error, refetch, setData } = useApiData(plantProfilesApi.getAll, [], 60000, 'plant-profiles');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [shopProducts, setShopProducts] = useState(null);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const list = useMemo(() => profiles || [], [profiles]);
  const linkedIds = useMemo(() => new Set(list.filter(profile => profile.shopSyncEnabled).map(profile => profile.sourceProductId).filter(Boolean)), [list]);

  const openNew = () => {
    setEditor('new');
    setForm(emptyForm());
    setSaveError('');
  };

  const openEdit = profile => {
    const soilTargets = profile.soilTargets || {};
    setEditor(profile);
    setForm({
      name: profile.name || '',
      category: profile.category || DEFAULT_PRODUCT_CATEGORY,
      imageUrl: profile.imageUrl || '',
      keepShopLink: Boolean(profile.shopSyncEnabled),
      soilTargets: {
        useDefault: soilTargets.useDefault !== false,
        npk: {
          nitrogen: targetValue(soilTargets.npk?.nitrogen),
          phosphorus: targetValue(soilTargets.npk?.phosphorus),
          potassium: targetValue(soilTargets.npk?.potassium),
        },
        ec: targetValue(soilTargets.ec),
        ph: targetValue(soilTargets.ph),
      },
    });
    setSaveError('');
  };

  const updateTarget = (field, value) => {
    setForm(current => field.group
      ? { ...current, soilTargets: { ...current.soilTargets, npk: { ...current.soilTargets.npk, [field.key]: value } } }
      : { ...current, soilTargets: { ...current.soilTargets, [field.key]: value } });
  };

  const makeTargetNumber = value => value === '' ? null : Number(value);

  const saveProfile = async event => {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    const payload = {
      name: form.name.trim(),
      category: form.category,
      imageUrl: form.imageUrl,
      keepShopLink: form.keepShopLink,
      soilTargets: {
        useDefault: form.soilTargets.useDefault,
        npk: {
          nitrogen: makeTargetNumber(form.soilTargets.npk.nitrogen),
          phosphorus: makeTargetNumber(form.soilTargets.npk.phosphorus),
          potassium: makeTargetNumber(form.soilTargets.npk.potassium),
        },
        ec: makeTargetNumber(form.soilTargets.ec),
        ph: makeTargetNumber(form.soilTargets.ph),
      },
    };

    try {
      if (editor === 'new') await plantProfilesApi.create(payload, token);
      else await plantProfilesApi.update(editor._id, payload, token);
      await refetch({ background: true });
      setEditor(null);
      setNotice(editor === 'new' ? 'Plant profile saved on this laptop.' : 'Plant profile updated on this laptop.');
    } catch (error) {
      setSaveError(error?.status === 409 ? 'A plant with this name and category is already saved.' : 'We could not save this plant profile. Check the name and targets, then try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeProfile = async () => {
    if (!deleteTarget) return;
    try {
      await plantProfilesApi.delete(deleteTarget._id, token);
      setData(list.filter(profile => profile._id !== deleteTarget._id));
      setNotice(`${deleteTarget.name} was removed from local plant monitoring.`);
      setDeleteTarget(null);
    } catch {
      setNotice('We could not remove this profile. Please try again.');
    }
  };

  const loadShopProducts = async () => {
    setShopLoading(true);
    setShopError('');
    try {
      setShopProducts(await productsApi.getAll(token));
    } catch {
      setShopError('Shop products need an internet connection. Your saved local profiles are still available.');
    } finally {
      setShopLoading(false);
    }
  };

  const importShopProduct = async product => {
    setShopError('');
    const existingProfile = list.find(profile => plantIdentity(profile.name, profile.category) === plantIdentity(product.name, product.category));
    try {
      const profile = await plantProfilesApi.importFromShop(product._id, token);
      setData(current => [...(current || []).filter(item => item._id !== profile._id && item.sourceProductId !== profile.sourceProductId), profile].sort((a, b) => a.name.localeCompare(b.name)));
      setNotice(existingProfile ? `${product.name} was linked to its existing local profile.` : `${product.name} was added to local plant profiles.`);
    } catch {
      setShopError('We could not copy that shop product. Check your internet connection and try again.');
    }
  };

  const syncPlantProfiles = async () => {
    setSyncing(true);
    setShopError('');
    try {
      const result = await plantProfilesApi.sync(token);
      await refetch({ background: true });
      if (!result.profiles?.available) {
        setNotice('Cloud plant profiles are unavailable. Your local profiles stay saved. Connect to the shop database and try again.');
      } else {
        const { imported, exported, alreadySaved, duplicates } = result.profiles;
        const parts = [];
        if (imported) parts.push(`${imported} copied from cloud`);
        if (exported) parts.push(`${exported} saved to cloud`);
        const syncNote = parts.length ? parts.join('; ') : 'No new profiles to copy';
        const existingNote = alreadySaved ? ` ${alreadySaved} matching profile${alreadySaved === 1 ? ' was' : 's were'} already saved and left unchanged.` : '';
        const duplicateNote = duplicates ? ` Skipped ${duplicates} duplicate profile${duplicates === 1 ? '' : 's'}.` : '';
        const shopNote = result.shop?.updated ? ` Updated ${result.shop.updated} linked shop plant${result.shop.updated === 1 ? '' : 's'}.` : '';
        setNotice(`${syncNote}.${existingNote}${duplicateNote}${shopNote}`);
      }
    } catch {
      setShopError('Cloud plant profiles are unavailable. Your saved local profiles are still available.');
    } finally {
      setSyncing(false);
    }
  };

  const setTargetInput = (field, value) => updateTarget(field, value);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-green-200 bg-green-50/70 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <i className="ti ti-device-laptop mt-0.5 text-lg text-green-800" aria-hidden="true" />
            <div>
              <h2 className="font-semibold text-text-primary">Saved on this laptop</h2>
              <p className="mt-1 max-w-3xl text-sm text-text-secondary">Profiles and soil targets stay available on this laptop. Sync copies missing profiles and targets in both directions with a separate cloud collection. Matching plants stay as they are. To sell one online, open Products and set its shop photo, price, and stock.</p>
              <p className="mt-1 text-sm text-text-secondary">One shared Main System sensor set is compared with every plant’s targets. These readings are not measured separately for each plant.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="default" onClick={syncPlantProfiles} disabled={syncing} icon="ti-refresh">
              {syncing ? 'Syncing…' : 'Sync plant profiles'}
            </Button>
            <Button variant="primary" onClick={openNew} icon="ti-plus">Add plant profile</Button>
          </div>
        </div>
      </section>

      {notice && <p className="rounded-lg border border-green-200 bg-white px-4 py-3 text-sm text-text-primary" role="status">{notice}</p>}
      {error && !profiles && <ErrorState title="Local plant profiles are not loading" description="Check that the local database is running, then try again." onRetry={refetch} />}

      <Card>
        <CardHeader title="Plants you are monitoring" subtitle={loading && !profiles ? 'Loading local profiles…' : `${list.length} local profile${list.length === 1 ? '' : 's'}`} />
        <CardBody>
          {list.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map(profile => {
                const targets = profile.soilTargets || {};
                const values = [
                  ['N', targets.npk?.nitrogen, 'mg/kg'],
                  ['P', targets.npk?.phosphorus, 'mg/kg'],
                  ['K', targets.npk?.potassium, 'mg/kg'],
                  ['pH', targets.ph, ''],
                  ['EC', targets.ec, 'µS/cm'],
                ].filter(([, value]) => value != null);
                return (
                  <article key={profile._id} className="rounded-xl border border-border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {profile.imageUrl ? <img src={profile.imageUrl} alt="" className="h-11 w-11 rounded-lg border border-border object-cover" /> : <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-green-50 text-lg text-green-800"><i className="ti ti-plant-2" aria-hidden="true" /></span>}
                        <div className="min-w-0"><h3 className="truncate font-semibold text-text-primary">{profile.name}</h3><p className="text-sm text-text-secondary">{profile.category || 'Plant'}</p></div>
                      </div>
                      {profile.shopSyncEnabled && <StatusBadge status="good" label="Shop linked" />}
                      {profile.sourceProductId && !profile.shopSyncEnabled && <StatusBadge status="none" label="Local copy" />}
                    </div>
                    <p className="mt-4 text-sm font-medium text-text-primary">{targets.useDefault !== false ? 'Default soil targets' : 'Your soil targets'}</p>
                    {values.length ? <div className="mt-2 flex flex-wrap gap-2">{values.map(([label, value, unit]) => <span key={label} className="rounded-lg border border-border bg-bg-secondary px-2.5 py-1.5 text-sm text-text-primary">{label}: <strong>{value}{unit ? ` ${unit}` : ''}</strong></span>)}</div> : <p className="mt-2 text-sm text-text-secondary">{targets.useDefault !== false ? 'Uses the default target settings.' : 'No target values have been entered.'}</p>}
                    {profile.shopSyncEnabled && <p className="mt-3 text-xs text-text-secondary">Name and category refresh from the shop. Soil targets stay local.</p>}
                    <div className="mt-4 flex gap-2 border-t border-border pt-3">
                      <Button variant="default" size="sm" onClick={() => openEdit(profile)}>Edit profile</Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(profile)}>Remove</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="ti-seeding" title="No local plant profiles yet" description="Add a plant and set its soil targets, or sync profiles saved in the cloud." action={<Button variant="primary" onClick={openNew} icon="ti-plus">Add plant profile</Button>} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Copy plants from the online shop" subtitle="Choose which shop plants to monitor. Only the name, category, and photo are copied; soil targets are managed here." actions={<Button variant="default" size="sm" onClick={loadShopProducts} disabled={shopLoading} icon="ti-cloud-download">{shopLoading ? 'Loading…' : shopProducts ? 'Refresh products' : 'Find shop plants'}</Button>} />
        {shopError && <div className="px-4 pt-3"><p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">{shopError}</p></div>}
        {shopProducts && (
          <CardBody className="pt-3">
            {shopProducts.length ? <div className="divide-y divide-border rounded-lg border border-border">
              {shopProducts.map(product => {
                const linked = linkedIds.has(product._id);
                const matchingProfile = list.find(profile => plantIdentity(profile.name, profile.category) === plantIdentity(product.name, product.category));
                const imported = linked || Boolean(matchingProfile?.shopSyncEnabled);
                return <div key={product._id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-border object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-800"><i className="ti ti-plant-2" aria-hidden="true" /></span>}
                    <div className="min-w-0"><p className="truncate font-medium text-text-primary">{product.name}</p><p className="text-sm text-text-secondary">{product.category}</p></div>
                  </div>
                  <Button variant={imported ? 'default' : 'primary'} size="sm" disabled={imported} onClick={() => importShopProduct(product)} icon={imported ? 'ti-circle-check' : matchingProfile ? 'ti-link' : 'ti-plus'}>{imported ? 'Already in Your plants' : matchingProfile ? 'Link saved profile' : 'Add to Your plants'}</Button>
                </div>;
              })}
            </div> : <EmptyState title="No shop products found" description="Add a plant product in Shop to add it to local monitoring." />}
          </CardBody>
        )}
      </Card>

      {editor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4" onMouseDown={event => event.target === event.currentTarget && setEditor(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="plant-profile-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-lg">
            <form onSubmit={saveProfile}>
              <div className="border-b border-border px-5 py-4"><h2 id="plant-profile-form-title" className="text-lg font-semibold text-text-primary">{editor === 'new' ? 'Add plant profile' : `Edit ${editor.name}`}</h2><p className="mt-1 text-sm text-text-secondary">Set the soil target values used for this plant’s checks.</p></div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Plant name" id="profile-name"><Input id="profile-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="e.g. Calamansi" required maxLength={120} disabled={form.keepShopLink} /></FormField>
                  <FormField label="Category" id="profile-category"><Select id="profile-category" value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))} disabled={form.keepShopLink}>{!PRODUCT_CATEGORIES.includes(form.category) && <option>{form.category}</option>}{PRODUCT_CATEGORIES.map(category => <option key={category}>{category}</option>)}</Select></FormField>
                </div>
                <section className="rounded-xl border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div><h3 className="font-medium text-text-primary">Soil reading targets</h3><p className="mt-1 text-sm text-text-secondary">Enter the target point for each reading. The dashboard uses its existing tolerance around each value.</p></div>
                    <label className="flex min-h-11 flex-shrink-0 items-center gap-2 text-sm text-text-primary"><input type="checkbox" checked={form.soilTargets.useDefault} disabled={form.keepShopLink} onChange={event => setForm(current => ({ ...current, soilTargets: { ...current.soilTargets, useDefault: event.target.checked } }))} />Use default targets</label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {targetFields.map(field => <FormField key={field.key} label={field.unit ? `${field.label} (${field.unit})` : field.label} id={`target-${field.key}`}><Input id={`target-${field.key}`} type="number" step={field.key === 'ph' ? '0.1' : '1'} value={field.group ? form.soilTargets.npk[field.key] : form.soilTargets[field.key]} onChange={event => setTargetInput(field, event.target.value)} placeholder={field.unit || 'Target value'} disabled={form.keepShopLink || form.soilTargets.useDefault} /></FormField>)}
                  </div>
                </section>
                {editor !== 'new' && editor.sourceProductId && <label className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-text-primary"><input type="checkbox" className="mt-1" checked={form.keepShopLink} onChange={event => setForm(current => ({ ...current, keepShopLink: event.target.checked }))} /><span><strong>Keep linked to the shop product.</strong><span className="mt-0.5 block text-text-secondary">While linked, the shop stays the source for the name and category. Soil targets stay local. Uncheck this to keep the plant as a local copy.</span></span></label>}
                {saveError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800" role="alert">{saveError}</p>}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end"><Button variant="default" onClick={() => setEditor(null)}>Cancel</Button><Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button></div>
            </form>
          </section>
        </div>
      )}

      <ConfirmDialog open={Boolean(deleteTarget)} title={`Remove ${deleteTarget?.name || 'this plant profile'}?`} message="This removes the profile from local monitoring. Any cloud copy stays saved and may sync back later. The shop product is unchanged." confirmLabel="Remove profile" onConfirm={removeProfile} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
};

export default PlantProfilesPage;
