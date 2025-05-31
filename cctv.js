var toolsEl = document.getElementById('tools');
var cameras = [];
var currentCam = null;

Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
}

/**
 * Build the coords for a polygon
 */
function buildPolyCoords(latlng, facingAngle, spanAngle, distMetres) {
    var pt1 = L.GeometryUtil.destination(latlng, facingAngle - (spanAngle / 2.0), distMetres);
    var pt2 = L.GeometryUtil.destination(latlng, facingAngle - (spanAngle / 4.0), distMetres);
    var pt3 = L.GeometryUtil.destination(latlng, facingAngle, distMetres);
    var pt4 = L.GeometryUtil.destination(latlng, facingAngle + (spanAngle / 4.0), distMetres);
    var pt5 = L.GeometryUtil.destination(latlng, facingAngle + (spanAngle / 2.0), distMetres);
    return [
        [latlng.lat, latlng.lng],
        [pt1.lat, pt1.lng],
        [pt2.lat, pt2.lng],
        [pt3.lat, pt3.lng],
        [pt4.lat, pt4.lng],
        [pt5.lat, pt5.lng],
    ];
}

/**
 * Add a camera at a given coordinate
 */
function addCamera(latlng) {
    var cam = {
        name: 'Camera ' + (cameras.length + 1), // Add name field with default value
        position: latlng,
        angle: 0,
        sensorSize: 6.43,   // mm diagional = 1/2.8"
        focalLength: 2.8,   // mm
        range: 30,          // metres
        notes: '',          // Add notes field
    };

    cam.fov = calcFov(cam.sensorSize, cam.focalLength);

    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    var ndPolygon = L.polygon(coords).addTo(map);

    var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
        color: 'red',
        fillColor: '#f03',
        fillOpacity: 0.5,
        radius: 0.5
    }).addTo(map);

    ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
    ndCentre.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });

    cam.ndPolygon = ndPolygon;
    cam.ndCentre = ndCentre;
    cameras.push(cam);

    setCurrent(cam);
}

/**
 * Find the closest camera to a given point within a threshold distance
 */
function findNearbyCamera(clickedLatLng, thresholdMeters = 10) {
    var closestCamera = null;
    var closestDistance = Infinity;
    
    cameras.forEach(function(cam) {
        var distance = map.distance(clickedLatLng, cam.position);
        if (distance < thresholdMeters && distance < closestDistance) {
            closestDistance = distance;
            closestCamera = cam;
        }
    });
    
    return closestCamera;
}

function calcFov(sensorSize, focalLength) {
    return Math.degrees(2 * Math.atan(sensorSize / (2.0 * focalLength)));
}

/**
 * Set the current camera in the tools panel
 */
function setCurrent(cam) {
    toolsEl.innerHTML = `
        Name: <input type="text" id="fld-name" value="${cam.name}" style="width: 200px; margin-bottom: 10px;"><br>
        ${cam.position.lat}<br>${cam.position.lng}
        <br>
        Angle: <input type="range" min="-360" max="360" id="fld-angle" value="${cam.angle}"> <span id="angle-value">${cam.angle}&deg;</span>
        <br>
        <br>Sensor: ${cam.sensorSize}mm
        <br>Focal Len: ${cam.focalLength}mm
        <br>
        <br>Range: <input type="range" min="1" max="100" id="fld-range" value="${cam.range}"> <span id="range-value">${cam.range}m</span>
        <br>FOV: <input type="range" min="1" max="359" id="fld-fov" value="${cam.fov}"> <span id="fov-value">${cam.fov.toFixed(1)}&deg;</span>
        <br>
        <br>Notes:<br>
        <textarea id="fld-notes" rows="4" cols="30" placeholder="Enter camera notes...">${cam.notes}</textarea>
    `;

    document.getElementById('fld-name').addEventListener('input', (e) => { 
        cam.name = e.target.value; 
    });

    document.getElementById('fld-angle').addEventListener('input', (e) => { 
        cam.angle = parseFloat(e.target.value); 
        document.getElementById('angle-value').innerHTML = cam.angle + '&deg;';
        renderCam(cam);
    });
    
    document.getElementById('fld-range').addEventListener('input', (e) => { 
        cam.range = parseFloat(e.target.value); 
        document.getElementById('range-value').textContent = cam.range + 'm';
        renderCam(cam);
    });
    
    document.getElementById('fld-fov').addEventListener('input', (e) => { 
        cam.fov = parseFloat(e.target.value); 
        document.getElementById('fov-value').innerHTML = cam.fov.toFixed(1) + '&deg;';
        renderCam(cam);
    });
    
    document.getElementById('fld-notes').addEventListener('input', (e) => { 
        cam.notes = e.target.value; 
    });

    currentCam = cam;
}

function renderCam(cam) {
    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    cam.ndPolygon.setLatLngs(coords);
}


function startMapCoords() {
    var urlParams = new URLSearchParams(window.location.search);
    var lat = urlParams.get('lat');
    var lng = urlParams.get('lng');
    var z = urlParams.get('z');
    if (lat && lng && z) {
        return [lat, lng, z];
    } else {
        return [-34.9285, 138.6007, 12];
    }
}

function setUrlCoords(map) {
    var urlParams = new URLSearchParams(location.search);
    urlParams.set('lat', map.getCenter().lat);
    urlParams.set('lng', map.getCenter().lng);
    urlParams.set('z', map.getZoom());
    var newUrl = location.protocol + "//" + location.host + location.pathname + '?' + urlParams.toString();
    history.replaceState(null, '', newUrl);
}

/**
 * Save the current setup to a JSON file
 */
function saveSetup() {
    var mapCenter = map.getCenter();
    var mapZoom = map.getZoom();
    
    // Create a clean copy of cameras without the Leaflet objects
    var camerasData = cameras.map(function(cam) {
        return {
            name: cam.name,  // Add name to saved data
            position: {
                lat: cam.position.lat,
                lng: cam.position.lng
            },
            angle: cam.angle,
            sensorSize: cam.sensorSize,
            focalLength: cam.focalLength,
            range: cam.range,
            fov: cam.fov,
            notes: cam.notes
        };
    });
    
    var setupData = {
        version: "1.0",
        timestamp: new Date().toISOString(),
        mapView: {
            center: {
                lat: mapCenter.lat,
                lng: mapCenter.lng
            },
            zoom: mapZoom
        },
        cameras: camerasData
    };
    
    // Create and download the file
    var dataStr = JSON.stringify(setupData, null, 2);
    var dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    var link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'cctv-setup-' + new Date().toISOString().slice(0, 10) + '.json';
    link.click();
}

/**
 * Load a setup from a JSON file
 */
function loadSetup(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var setupData = JSON.parse(e.target.result);
            
            // Validate the file format
            if (!setupData.version || !setupData.cameras || !setupData.mapView) {
                alert('Invalid setup file format');
                return;
            }
            
            // Clear existing cameras
            clearAllCameras();
            
            // Restore map view
            map.setView([setupData.mapView.center.lat, setupData.mapView.center.lng], setupData.mapView.zoom);
            
            // Restore cameras
            setupData.cameras.forEach(function(camData) {
                var latlng = L.latLng(camData.position.lat, camData.position.lng);
                var cam = {
                    name: camData.name || 'Camera ' + (cameras.length + 1), // Handle backward compatibility
                    position: latlng,
                    angle: camData.angle,
                    sensorSize: camData.sensorSize,
                    focalLength: camData.focalLength,
                    range: camData.range,
                    fov: camData.fov,
                    notes: camData.notes || ''
                };
                
                var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
                var ndPolygon = L.polygon(coords).addTo(map);
                
                var ndCentre = L.circle([cam.position.lat, cam.position.lng], {
                    color: 'red',
                    fillColor: '#f03',
                    fillOpacity: 0.5,
                    radius: 0.5
                }).addTo(map);
                
                ndPolygon.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
                ndCentre.on('click', function(e) { L.DomEvent.stopPropagation(e); setCurrent(cam) });
                
                cam.ndPolygon = ndPolygon;
                cam.ndCentre = ndCentre;
                cameras.push(cam);
            });
            
            // Clear current selection
            currentCam = null;
            toolsEl.innerHTML = '<p>Setup loaded successfully!<br>Click on a camera or add a new one by clicking on the map.</p>';
            
            // Update URL to reflect new position
            setUrlCoords(map);
            
        } catch (error) {
            alert('Error loading setup file: ' + error.message);
        }
    };
    reader.readAsText(file);
}

/**
 * Clear all cameras from the map
 */
function clearAllCameras() {
    cameras.forEach(function(cam) {
        map.removeLayer(cam.ndPolygon);
        map.removeLayer(cam.ndCentre);
    });
    cameras = [];
    currentCam = null;
    toolsEl.innerHTML = '';
}

/**
 * Initialize save/load event listeners
 */
function initSaveLoad() {
    document.getElementById('save-setup').addEventListener('click', function() {
        saveSetup();
    });
    
    document.getElementById('load-setup').addEventListener('change', function(e) {
        var file = e.target.files[0];
        if (file) {
            loadSetup(file);
        }
        // Reset file input so the same file can be loaded again if needed
        e.target.value = '';
    });
}


function init() {
    // OpenStreetMap
    var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    // Google Satellite
    var sat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
        maxZoom: 20,
        subdomains:['mt0','mt1','mt2','mt3'],
        attribution: '&copy; Google'
    });

    var coords = startMapCoords();
    var map = L.map('map', {
        center: [coords[0], coords[1]],
        zoom: coords[2],
        layers: [osm]
    });

    L.control.layers({
        "OpenStreetMap": osm,
        "Google Satellite": sat,
    }, {}).addTo(map);

    map.on('click', (e) => {
        var nearbyCamera = findNearbyCamera(e.latlng);
        if (nearbyCamera) {
            setCurrent(nearbyCamera);
        } else {
            addCamera(e.latlng);
        }
    });
    map.on('moveend', (e) => setUrlCoords(map));

    window.map = map;
    initSaveLoad();
}


init();
