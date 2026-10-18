import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, CardBody, ConfirmDialog, EmptyState, ErrorState, FormField, Input, StatusBadge } from '../components/ui/UI';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { monitoringSetupApi, plantProfilesApi } from '../api/client';

const when = (value) => value ? new Date(value).toLocaleString() : 'Never measured';
const show = (value, unit = '') => value == null ? '—' : `${value}${unit}`;
const blankForm = { name: '', plantProfileIds: [] };

const GrowingAreasPage = () => {
  const { token, user } = useAuth();
  const canEdit = ['admin', 'staff'].includes(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('plotId');
  const { data: plots, error: plotsError, refetch: refetchPlots } = useApiData(monitoringSetupApi.getPlots, [], 10000);
  const { data: profiles } = useApiData(plantProfilesApi.getAll, [], 30000);
  const { data: detail, error: detailError, refetch: refetchDetail } = useApiData(
    (t) => selectedId ? monitoringSetupApi.getPlot(selectedId, t) : Promise.resolve(null), [selectedId], 10000
  );
  const { data: readingsResult, error: readingsError, refetch: refetchReadings } = useApiData(
    async (t) => ({ plotId: selectedId, rows: selectedId ? await monitoringSetupApi.getPlotReadings(selectedId, t) : [] }), [selectedId], 15000
  );
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingActivation, setPendingActivation] = useState(null);

  useEffect(() => {
    if (!plots?.length) return;
    if (!plots.some((plot) => String(plot._id) === selectedId)) {
      setSearchParams({ plotId: String(plots.find((plot) => plot.isActive)?._id || plots[0]._id) }, { replace: true });
    }
  }, [plots, selectedId, setSearchParams]);

  const selected = String(detail?._id || '') === selectedId ? detail : null;
  const history = selected && readingsResult?.plotId === selectedId ? readingsResult.rows : [];
  const editPlot = (plot) => {
    setMessage('');
    setEditingId(plot?._id || 'new');
    setForm(plot ? { name: plot.name, plantProfileIds: (plot.plantProfileIds || []).map(String) } : blankForm);
  };
  const togglePlant = (id) => setForm((current) => ({
    ...current,
    plantProfileIds: current.plantProfileIds.includes(id)
      ? current.plantProfileIds.filter((item) => item !== id)
      : [...current.plantProfileIds, id],
  }));
  const savePlot = async (event) => {
    event.preventDefault();
    setSaving(true); setMessage('');
    try {
      const saved = editingId === 'new'
        ? await monitoringSetupApi.createPlot(form, token)
        : await monitoringSetupApi.updatePlot(editingId, form, token);
      setEditingId(null);
      setSearchParams({ plotId: String(saved._id) });
      await refetchPlots();
      setMessage(`${saved.name} saved.`);
    } catch (error) {
      setMessage(error.message || 'We could not save this area. Please try again.');
    } finally { setSaving(false); }
  };
  const activate = async () => {
    const plot = pendingActivation;
    setPendingActivation(null);
    setMessage('');
    try {
      await monitoringSetupApi.activatePlot(plot._id, token);
      await refetchPlots();
      await refetchDetail();
      setMessage(`The probe is assigned to ${plot.name}. Waiting for a new reading from that area.`);
    } catch (error) {
      setMessage(error.message || 'We could not move the probe assignment. Please try again.');
    }
  };

  return <div className="space-y-5">
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
      <h2 className="font-semibold">One probe, one live growing area</h2>
      <p className="mt-1">Add as many areas as you need. Only the area holding the probe can show live soil readings. Other areas show their last saved measurement.</p>
    </section>
    {(plotsError || detailError || readingsError) && <ErrorState title="Growing areas are not loading" description="Check the local server, then try again." onRetry={() => { refetchPlots(); refetchDetail(); refetchReadings(); }} />}
    {message && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{message}</p>}

    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card>
        <CardBody>
          <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-semibold">Growing areas</h2>{canEdit && <Button size="sm" variant="primary" onClick={() => editPlot(null)}>Add area</Button>}</div>
          <div className="mt-4 space-y-2">
            {plots?.map((plot) => <button key={plot._id} type="button" onClick={() => setSearchParams({ plotId: String(plot._id) })} className={`w-full rounded-xl border p-3 text-left ${selectedId === String(plot._id) ? 'border-green-700 bg-green-50' : 'border-border bg-white hover:bg-bg-secondary'}`}>
              <span className="flex items-start justify-between gap-2"><strong className="text-text-primary">{plot.name}</strong><StatusBadge status={plot.isLive ? 'good' : 'none'} label={plot.isLive ? 'Live' : plot.isActive ? 'Probe here · waiting' : plot.lastMeasuredAt ? 'Last measured' : 'No readings'} /></span>
              <span className="mt-1 block text-sm text-text-secondary">{when(plot.lastMeasuredAt)}</span>
              {plot.isWateredArea && <span className="mt-1 block text-xs font-medium text-green-800">Shared watering system is connected here</span>}
            </button>)}
            {plots && !plots.length && <EmptyState title="No growing areas yet" description="Add an area to start organizing soil readings." />}
          </div>
        </CardBody>
      </Card>

      <div className="space-y-5">
        {selected ? <>
          <Card><CardBody>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-xl font-semibold text-text-primary">{selected.name}</h2><p className="mt-1 text-sm text-text-secondary">{selected.isLive ? 'Fresh readings from the probe in this area.' : `Last measured: ${when(selected.lastMeasuredAt)}. These values are not live.`}</p></div>
              <div className="flex flex-wrap gap-2">{canEdit && <Button size="sm" onClick={() => editPlot(selected)}>Edit area</Button>}{canEdit && !selected.isActive && <Button size="sm" variant="primary" onClick={() => setPendingActivation(selected)}>Probe is now here</Button>}</div>
            </div>
            {selected.isActive && !selected.isLive && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Waiting for a fresh soil reading from this area. Older readings remain in its history.</p>}
            {!selected.isWateredArea && <p className="mt-3 rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">The shared pump and backup line water the original growing area. They cannot be turned on while the probe is assigned here.</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Soil wetness', selected.latestSoil?.moisture, '%'],
                ['Soil acidity (pH)', selected.latestSoil?.ph, ''],
                ['Soil salt (EC)', selected.latestSoil?.ec, ' µS/cm'],
                ['Nitrogen (N)', selected.latestSoil?.nitrogen, ' mg/kg'],
                ['Phosphorus (P)', selected.latestSoil?.phosphorus, ' mg/kg'],
                ['Potassium (K)', selected.latestSoil?.potassium, ' mg/kg'],
              ].map(([label, value, unit]) => <div key={label} className="rounded-xl border border-border bg-bg-secondary p-3"><p className="text-sm text-text-secondary">{label}</p><p className="mt-1 text-xl font-semibold text-text-primary">{selected.latestSoil?.valid ? show(value, unit) : '—'}</p></div>)}
            </div>
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="text-lg font-semibold text-text-primary">Plants in this area</h2>
            <p className="mt-1 text-sm text-text-secondary">Each plant profile uses this area’s shared soil reading and its own targets. {!selected.isLive && 'These checks use the last saved reading and may be out of date.'}</p>
            {selected.plantChecks?.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{selected.plantChecks.map((plant) => {
              const concern = plant.checks?.find((item) => item.severity === 'high' || item.severity === 'medium');
              const hasCheck = plant.checks?.some((item) => item.category !== 'General' && item.reading != null);
              const status = !hasCheck ? 'none' : concern?.severity === 'high' ? 'action' : concern ? 'check' : 'good';
              const statusWord = { none: 'No data', action: 'Needs action', check: 'Check soon', good: 'Good' }[status];
              return <article key={plant.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-2"><strong>{plant.name}</strong><StatusBadge status={status} label={!selected.isLive && hasCheck ? `${statusWord} at last check` : statusWord} /></div><p className="mt-1 text-sm text-text-secondary">{concern?.message || (hasCheck ? 'Soil readings match this profile’s targets.' : 'Waiting for a valid soil reading.')}</p></article>;
            })}</div> : <p className="mt-3 text-sm text-text-secondary">No plants assigned yet. Edit this area to choose plant profiles.</p>}
          </CardBody></Card>

          <Card><CardBody>
            <h2 className="text-lg font-semibold text-text-primary">Recent soil readings</h2>
            <p className="mt-1 text-sm text-text-secondary">Saved readings stay with this area after you move the probe.</p>
            {history.length ? <div className="mt-3 divide-y divide-border">{history.slice(0, 10).map((reading) => <div key={reading._id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="text-text-secondary">{when(reading.recordedAt)}</span><span>{reading.soilReadingValid === false ? 'Soil reading was not valid' : `Wetness ${show(reading.soilMoisture, '%')} · pH ${show(reading.ph)} · EC ${show(reading.ec, ' µS/cm')}`}</span></div>)}</div> : <p className="mt-3 text-sm text-text-secondary">No readings saved for this area yet.</p>}
          </CardBody></Card>
        </> : <Card><CardBody><p className="text-sm text-text-secondary">Choose a growing area to see its plants and readings.</p></CardBody></Card>}
      </div>
    </div>

    {editingId && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && setEditingId(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="area-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-lg">
        <h2 id="area-form-title" className="text-lg font-semibold">{editingId === 'new' ? 'Add growing area' : 'Edit growing area'}</h2>
        <p className="mt-1 text-sm text-text-secondary">Name the bed and choose the plant profiles grown there.</p>
        <form onSubmit={savePlot} className="mt-4 space-y-4">
          <FormField label="Bed or area name" id="area-name"><Input id="area-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Area B" maxLength={120} required /></FormField>
          <fieldset className="rounded-xl border border-border p-3"><legend className="px-1 font-semibold">Plants in this area</legend><div className="grid gap-2 sm:grid-cols-2">{profiles?.map((profile) => <label key={profile._id} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><input type="checkbox" checked={form.plantProfileIds.includes(String(profile._id))} onChange={() => togglePlant(String(profile._id))} />{profile.name}</label>)}</div>{!profiles?.length && <p className="text-sm text-text-secondary">Add plant profiles first.</p>}</fieldset>
          <div className="flex justify-end gap-2"><Button onClick={() => setEditingId(null)}>Cancel</Button><Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save area'}</Button></div>
        </form>
      </section>
    </div>}

    <ConfirmDialog open={Boolean(pendingActivation)} title={`Move the probe to ${pendingActivation?.name || 'this area'}?`} message="First turn watering off on the Watering page and wait for the ESP32 to confirm it stopped. Physically place the soil probe in this area before confirming. The app will wait for a fresh reading." confirmLabel="Probe is in this area" onConfirm={activate} onCancel={() => setPendingActivation(null)} />
    <p className="text-sm text-text-secondary">Need to stop watering first? <Link className="font-medium text-green-800 underline" to="/irrigation">Open Watering</Link>.</p>
  </div>;
};

export default GrowingAreasPage;
