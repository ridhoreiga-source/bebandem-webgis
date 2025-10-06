// Inisialisasi peta
var map = L.map('map', {
  center: [-8.433, 115.55],
  zoom: 14,
  zoomControl: true
});

// Basemap
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

var satellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
  subdomains: ['mt0','mt1','mt2','mt3'],
  attribution: 'Google Satellite'
});

var terrain = L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
  subdomains: ['mt0','mt1','mt2','mt3'],
  attribution: 'Google Terrain'
});

// Layer kosong dulu
var banjarLayer, kepadatanLayer;

// Fungsi warna kepadatan
function getColor(d) {
  return d >= 1569 ? '#800026' :
         d >= 1358 ? '#BD0026' :
         d >= 1095 ? '#E31A1C' :
         d >= 981  ? '#FC4E2A' :
         d >= 742  ? '#FD8D3C' :
                     '#FFEDA0';
}

// Control layer
var baseMaps = {
  "OSM": osm,
  "Satellite": satellite,
  "Terrain": terrain
};
var layerControl = L.control.layers(baseMaps, {}).addTo(map);

// --- Load Banjar Dinas ---
fetch("data/banjar_dinas.geojson")
.then(res => res.json())
.then(data => {
  banjarLayer = L.geoJSON(data, {
    style: { color: "orange", weight: 1, fillOpacity: 0.3 },
    onEachFeature: function(feature, layer) {
      var props = feature.properties;
      var fotoPath = "img/" + props.Banjar.toUpperCase() + ".jpg";
      var popupContent = `
        <h3>${props.Banjar}</h3>
        <img src="${fotoPath}" alt="${props.Banjar}"><br>
        <b>Luas (km²):</b> ${props.Luas_km2}<br>
        <b>Topografi:</b> ${props.Topografi}<br>
        <b>KK (2023):</b> ${props.KK_2023}<br>
        <b>Jiwa (2023):</b> ${props.Jiwa_2023}
      `;
      layer.bindPopup(popupContent);
    }
  }).addTo(map);

  layerControl.addOverlay(banjarLayer, "Banjar Dinas");

  // Search
  var searchControl = new L.Control.Search({
    layer: banjarLayer,
    propertyName: 'Banjar',
    initial: false,
    zoom: 17,
    marker: false,
    textPlaceholder: 'Cari Banjar Dinas...'
  });
  searchControl.on('search:locationfound', function(e) { e.layer.openPopup(); });
  map.addControl(searchControl);
});

// --- Load Kepadatan ---
fetch("data/kepadatan.geojson")
.then(res => res.json())
.then(data => {
  kepadatanLayer = L.geoJSON(data, {
    style: f => ({
      fillColor: getColor(f.properties.Densi_2023),
      weight: 1,
      color: "#555",
      fillOpacity: 0.7
    }),
    onEachFeature: function(feature, layer) {
      var props = feature.properties;
      var popupContent = `
        <b>Banjar:</b> ${props.Banjar}<br>
        <b>Jiwa (2023):</b> ${props.Jiwa_2023}<br>
        <b>Luas (km²):</b> ${props.Area_km2}<br>
        <b>Kepadatan:</b> ${props.Densi_2023} jiwa/km²
      `;
      layer.bindPopup(popupContent);
    }
  });
  layerControl.addOverlay(kepadatanLayer, "Kepadatan");
});

// --- Legend ---
var legend = L.control({position: 'bottomright'});
legend.onAdd = function(map) {
  var div = L.DomUtil.create('div', 'info legend'),
      grades = [742, 981, 1095, 1358, 1569, 2506];
  div.innerHTML += '<h4>Kepadatan Jiwa/km²</h4>';
  for (var i = 0; i < grades.length - 1; i++) {
    div.innerHTML +=
      '<i style="background:' + getColor(grades[i]+1) + '"></i> ' +
      grades[i] + '&ndash;' + grades[i+1] + '<br>';
  }
  return div;
};
map.on('overlayadd', e => { if (e.name === "Kepadatan") legend.addTo(map); });
map.on('overlayremove', e => { if (e.name === "Kepadatan") map.removeControl(legend); });

// --- Koordinat Cursor ---
var coords = L.control({position: 'bottomleft'});
coords.onAdd = function() {
  var div = L.DomUtil.create('div', 'coords');
  map.on('mousemove', e => {
    div.innerHTML = "Lat: " + e.latlng.lat.toFixed(5) +
                    " , Lng: " + e.latlng.lng.toFixed(5);
  });
  return div;
};
coords.addTo(map);

/* ======= Measurement (Leaflet.draw + Turf.js) ======= */
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawPolyline = new L.Draw.Polyline(map, {
  shapeOptions: { color: '#ff0000', weight: 3 }
});
var drawPolygon = new L.Draw.Polygon(map, {
  allowIntersection: false,
  showArea: true,
  shapeOptions: { color: '#ff0000', weight: 2, fillOpacity: 0.15 }
});

// Custom control
var MeasureControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function(map) {
    var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-measure-custom');
    var btnLine = L.DomUtil.create('a', 'measure-btn', container);
    btnLine.title = 'Measure Distance'; btnLine.innerHTML = '↔';
    L.DomEvent.on(btnLine, 'click', e => { L.DomEvent.stop(e); drawPolyline.enable(); });

    var btnArea = L.DomUtil.create('a', 'measure-btn', container);
    btnArea.title = 'Measure Area'; btnArea.innerHTML = '▦';
    L.DomEvent.on(btnArea, 'click', e => { L.DomEvent.stop(e); drawPolygon.enable(); });

    var btnClear = L.DomUtil.create('a', 'measure-btn measure-clear', container);
    btnClear.title = 'Clear Measurements'; btnClear.innerHTML = '✕';
    L.DomEvent.on(btnClear, 'click', e => { L.DomEvent.stop(e); drawnItems.clearLayers(); map.closePopup(); });

    return container;
  }
});
map.addControl(new MeasureControl());

// Event hasil gambar
map.on(L.Draw.Event.CREATED, function(event) {
  var layer = event.layer, type = event.layerType;
  drawnItems.addLayer(layer);

  if (type === 'polyline') {
    var coords = layer.getLatLngs().map(p => [p.lng, p.lat]);
    var line = turf.lineString(coords);
    var lengthKm = turf.length(line, {units:'kilometers'});
    var content = '<b>Jarak:</b> ' + (lengthKm >= 1 ? lengthKm.toFixed(3)+' km' : (lengthKm*1000).toFixed(1)+' m');
    var midpoint = turf.along(line, lengthKm/2, {units:'kilometers'});
    L.popup().setLatLng([midpoint.geometry.coordinates[1], midpoint.geometry.coordinates[0]])
             .setContent(content).openOn(map);
  }

  if (type === 'polygon') {
    var coords = layer.getLatLngs()[0].map(p => [p.lng, p.lat]);
    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) coords.push(coords[0]);
    var poly = turf.polygon([coords]);
    var areaM2 = turf.area(poly), areaHa = areaM2 / 10000;
    var content = '<b>Luas:</b> ' + areaHa.toFixed(3) + ' ha (' + Math.round(areaM2).toLocaleString() + ' m²)';
    var center = layer.getBounds().getCenter();
    L.popup().setLatLng(center).setContent(content).openOn(map);
  }
});

// Disable dragging saat gambar
map.on('draw:drawstart', () => { map.dragging.disable(); map.getContainer().style.cursor = 'crosshair'; });
map.on('draw:drawstop', () => { map.dragging.enable(); map.getContainer().style.cursor = ''; });

// --- Skala ---
L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);
