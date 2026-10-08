import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

const WeatherContext = createContext(null);

const fetchForecast = async ({ latitude, longitude }) => {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,rain_sum,wind_speed_10m_max,sunrise,sunset,uv_index_max,et0_fao_evapotranspiration',
    forecast_days: 7,
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error('Weather forecast is temporarily unavailable.');
  return response.json();
};

export const WeatherProvider = ({ children }) => {
  const [weather, setWeather] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const coordinatesRef = useRef(null);
  const hasWeatherRef = useRef(false);
  const hasLocationNameRef = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Location is not supported by this browser.');
      setLoading(false);
      return undefined;
    }

    let active = true;
    let lastWeatherFetch = 0;
    let lastLocationFetch = 0;
    const loadLocationName = async (coords) => {
      if (Date.now() - lastLocationFetch < 60000) return;
      lastLocationFetch = Date.now();
      hasLocationNameRef.current = false;
      setLocationName('');
      const params = new URLSearchParams({
        latitude: coords.latitude,
        longitude: coords.longitude,
        localityLanguage: 'en',
      });
      try {
        const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`);
        if (!response.ok) return;
        const place = await response.json();
        const name = [place.locality || place.city, place.principalSubdivision, place.countryName]
          .filter((part, index, parts) => part && parts.indexOf(part) === index)
          .join(', ');
        if (active && name) {
          hasLocationNameRef.current = true;
          setLocationName(name);
        }
      } catch {
        // The forecast remains usable when reverse geocoding is unavailable.
      }
    };

    const loadWeather = async (coords, force = false) => {
      coordinatesRef.current = coords;
      setLocation(coords);
      if (!force && Date.now() - lastWeatherFetch < 60000) return;
      lastWeatherFetch = Date.now();
      setLoading(true);
      setError('');
      try {
        const forecast = await fetchForecast(coords);
        if (active) {
          hasWeatherRef.current = true;
          setWeather(forecast);
        }
      } catch (err) {
        if (active) setError(err.message || 'Unable to load the weather forecast.');
      } finally {
        if (active) setLoading(false);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude };
        const previous = coordinatesRef.current;
        const movedKm = previous
          ? Math.hypot((next.latitude - previous.latitude) * 111, (next.longitude - previous.longitude) * 111 * Math.cos(next.latitude * Math.PI / 180))
          : Infinity;
        if (movedKm > 1 || !hasLocationNameRef.current) loadLocationName(next);
        loadWeather(next, movedKm > 1 || !hasWeatherRef.current);
      },
      (geoError) => {
        if (!active) return;
        setError(geoError.code === 1
          ? 'Allow location access to see local weather.'
          : 'Unable to determine your location. Check location services and retry.');
        setLoading(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }
    );

    const refreshInterval = window.setInterval(() => {
      if (coordinatesRef.current) loadWeather(coordinatesRef.current, true);
    }, 15 * 60 * 1000);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(refreshInterval);
    };
  }, [refreshKey]);

  const refresh = () => {
    setLoading(true);
    setRefreshKey(key => key + 1);
  };

  return (
    <WeatherContext.Provider value={{ weather, location, locationName, loading, error, refresh }}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeather = () => {
  const context = useContext(WeatherContext);
  if (!context) throw new Error('useWeather must be used within a WeatherProvider.');
  return context;
};