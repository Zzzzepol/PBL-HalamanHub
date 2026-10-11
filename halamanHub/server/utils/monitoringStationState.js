let snapshot = {
  name: 'Main System',
  location: '',
  plantProfileIds: [],
  monitoredPlantNames: [],
};

function setMonitoringStation(station, plants = []) {
  snapshot = {
    name: station?.name || 'Main System',
    location: station?.location || '',
    plantProfileIds: (station?.plantProfileIds || []).map((id) => String(id?._id || id)),
    monitoredPlantNames: plants.map((plant) => plant.name).filter(Boolean),
  };
  return getMonitoringStation();
}

function getMonitoringStation() {
  return { ...snapshot, plantProfileIds: [...snapshot.plantProfileIds], monitoredPlantNames: [...snapshot.monitoredPlantNames] };
}

module.exports = { getMonitoringStation, setMonitoringStation };
