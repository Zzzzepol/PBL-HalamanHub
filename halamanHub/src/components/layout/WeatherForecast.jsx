import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/UI';
import { useWeather } from '../../context/WeatherContext';

const weatherDescription = (code) => {
  if (code === 0) return 'Clear sky';
  if ([1, 2].includes(code)) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Showers';
};

export const weatherIcon = (code, isDay = true) => {
  if (code === 0) return isDay ? 'ti-sun' : 'ti-moon';
  if ([1, 2, 3].includes(code)) return isDay ? 'ti-cloud-sun' : 'ti-cloud-moon';
  if ([45, 48].includes(code)) return 'ti-cloud-fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'ti-cloud-rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'ti-cloud-snow';
  return 'ti-cloud-storm';
};

const formatDay = (date, index) => index === 0
  ? 'Today'
  : new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: 'short' });

const WeatherForecast = ({ compact = false }) => {
  const { weather, location, locationName, loading, error, refresh } = useWeather();
  const current = weather?.current;
  const daily = weather?.daily;
  const hourly = weather?.hourly;
  const todayRainChance = daily?.precipitation_probability_max?.[0] ?? null;
  const rainSummary = todayRainChance == null
    ? 'Rain forecast unavailable'
    : todayRainChance >= 60 ? 'Rain likely today'
      : todayRainChance >= 30 ? 'Rain possible today'
        : todayRainChance > 0 ? 'Low chance of rain today'
          : 'No rain expected today';

  if (!weather) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
        <i className={`ti ${loading ? 'ti-loader-2 animate-spin' : 'ti-map-pin'} text-3xl text-text-secondary`} aria-hidden="true" />
        <div>
          <div className="text-sm font-medium text-text-primary">{loading ? 'Getting local weather…' : 'Local weather unavailable'}</div>
          <div className="text-sm text-text-secondary mt-1">{error || 'Allow location access to get your local forecast.'}</div>
        </div>
        {!loading && <Button size="sm" variant="outline" icon="ti-refresh" onClick={refresh}>Try again</Button>}
      </div>
    );
  }

  const nextHours = hourly?.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => new Date(time).getTime() >= Date.now())
    .slice(0, 12) || [];

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-border bg-sky-50/70 p-4">
        <div className="flex items-center gap-4">
          <i className={`ti ${weatherIcon(current.weather_code, current.is_day)} text-5xl text-sky-700`} aria-hidden="true" />
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-semibold text-text-primary">{Math.round(current.temperature_2m)}°</span>
              <span className="text-sm text-text-secondary">Feels like {Math.round(current.apparent_temperature)}°C</span>
            </div>
            <div className="text-sm font-medium text-text-primary">{weatherDescription(current.weather_code)}</div>
            <div className="text-xs text-text-secondary mt-0.5">
              <i className="ti ti-map-pin mr-1" aria-hidden="true" />{locationName || `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm">
          <div><span className="text-text-secondary">Humidity</span><div className="font-medium">{current.relative_humidity_2m}%</div></div>
          <div><span className="text-text-secondary">Cloud cover</span><div className="font-medium">{current.cloud_cover}%</div></div>
          <div><span className="text-text-secondary">Wind</span><div className="font-medium">{Math.round(current.wind_speed_10m)} km/h</div></div>
          <div><span className="text-text-secondary">Pressure</span><div className="font-medium">{Math.round(current.pressure_msl)} hPa</div></div>
        </div>
      </section>

      <section className={`flex items-center gap-3 rounded-md border px-3.5 py-3 ${todayRainChance >= 60 ? 'border-blue-200 bg-blue-50' : todayRainChance >= 30 ? 'border-sky-200 bg-sky-50' : 'border-green-200 bg-green-50'}`} aria-live="polite">
        <i className={`ti ${todayRainChance > 0 ? 'ti-cloud-rain' : 'ti-sun'} text-2xl ${todayRainChance >= 30 ? 'text-blue-700' : 'text-green-700'}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text-primary">{rainSummary}</div>
          <div className="text-xs text-text-secondary">{todayRainChance == null ? 'Check again later' : `${todayRainChance}% chance · ${(daily.precipitation_sum[0] ?? 0).toFixed(1)} mm expected`}</div>
        </div>
        {todayRainChance != null && <div className="text-xl font-semibold text-text-primary">{todayRainChance}%</div>}
      </section>

      {error && <div className="text-xs text-amber-800">{error} Showing the most recently loaded forecast.</div>}

      <section>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-text-primary">7-day outlook</h3>
          <Button size="sm" variant="outline" icon="ti-refresh" onClick={refresh} disabled={loading} aria-label="Refresh weather forecast">
            {loading ? 'Updating…' : 'Refresh'}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
          {daily.time.map((date, index) => (
            <div key={date} className="min-w-0 rounded-md border border-border bg-white p-2.5">
              <div className="text-xs font-semibold text-text-primary">{formatDay(date, index)}</div>
              <i className={`ti ${weatherIcon(daily.weather_code[index])} block text-2xl text-sky-700 my-2`} aria-hidden="true" />
              <div className="text-[11px] text-text-secondary truncate">{weatherDescription(daily.weather_code[index])}</div>
              <div className="mt-1 text-sm font-semibold">{Math.round(daily.temperature_2m_max[index])}° <span className="font-normal text-text-secondary">{Math.round(daily.temperature_2m_min[index])}°</span></div>
              <div className="mt-2 border-t border-border pt-2">
                <div className="text-[11px] font-medium text-sky-900">Rain chance</div>
                <div className="text-sm font-semibold text-sky-800">{daily.precipitation_probability_max[index] ?? 0}%</div>
                <div className="text-[11px] text-text-secondary">{(daily.precipitation_sum[index] ?? 0).toFixed(1)} mm expected</div>
              </div>
              <div className="mt-2 text-[11px] text-text-secondary">UV {Math.round(daily.uv_index_max[index] ?? 0)} · Wind {Math.round(daily.wind_speed_10m_max[index])} km/h</div>
            </div>
          ))}
        </div>
      </section>

      {!compact && (
        <section>
          <h3 className="text-sm font-semibold text-text-primary mb-2">Next 12 hours</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {nextHours.map(({ time, index }) => (
              <div key={time} className="min-w-[82px] rounded-md border border-border px-2.5 py-2 text-center">
                <div className="text-xs text-text-secondary">{new Date(time).toLocaleTimeString([], { hour: 'numeric' })}</div>
                <i className={`ti ${weatherIcon(hourly.weather_code[index])} block text-xl text-sky-700 my-1`} aria-hidden="true" />
                <div className="text-sm font-semibold">{Math.round(hourly.temperature_2m[index])}°</div>
                <div className="text-[11px] text-sky-800"><i className="ti ti-droplet" aria-hidden="true" /> {hourly.precipitation_probability[index] ?? 0}%</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary border-t border-border pt-3">
          <span><i className="ti ti-sunrise mr-1" aria-hidden="true" />Sunrise {new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          <span><i className="ti ti-sunset mr-1" aria-hidden="true" />Sunset {new Date(daily.sunset[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          <span>Rain today {(daily.rain_sum[0] ?? 0).toFixed(1)} mm</span>
          <span>Evapotranspiration {(daily.et0_fao_evapotranspiration[0] ?? 0).toFixed(1)} mm</span>
          <span>Wind gusts {Math.round(current.wind_gusts_10m)} km/h</span>
        </div>
      )}
      <div className="text-[11px] text-text-secondary">Forecast by Open-Meteo · Updated {new Date(weather.current.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
    </div>
  );
};

export const WeatherModal = ({ onClose }) => createPortal(
  <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-3 sm:p-5" onClick={onClose}>
    <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-border bg-bg-primary p-4 shadow-xl sm:p-5" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Weekly local weather forecast">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Local weather</h2>
          <p className="text-xs text-text-secondary">Current conditions and this week’s forecast</p>
        </div>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-bg-secondary" onClick={onClose} aria-label="Close weather forecast">
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      </div>
      <WeatherForecast />
    </div>
  </div>,
  document.body
);

export default WeatherForecast;