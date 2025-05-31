var toolsEl = document.getElementById('tools');
var cameras = [];
var currentCam = null;
var isDraggingCamera = false;
var dragStartPos = null;
var draggedCamera = null;

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

    ndPolygon.on('click', function(e) { 
        if (!isDraggingCamera) {
            L.DomEvent.stopPropagation(e); 
            setCurrent(cam);
        }
    });
    
    ndCentre.on('click', function(e) { 
        if (!isDraggingCamera) {
            L.DomEvent.stopPropagation(e); 
            setCurrent(cam);
        }
    });
    
    // Add drag functionality to the center circle
    ndCentre.on('mousedown', function(e) {
        startCameraDrag(cam, e);
    });
    
    // Add visual feedback for draggable cameras
    if (ndCentre.getElement()) {
        ndCentre.getElement().classList.add('camera-draggable');
    }

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

/**
 * Start dragging a camera
 */
function startCameraDrag(cam, e) {
    isDraggingCamera = true;
    draggedCamera = cam;
    dragStartPos = e.latlng;
    
    // Disable map dragging
    map.dragging.disable();
    
    // Add visual feedback
    document.body.classList.add('dragging-camera');
    cam.ndCentre.getElement().style.cursor = 'grabbing';
    
    // Prevent event propagation
    L.DomEvent.stopPropagation(e);
    L.DomEvent.preventDefault(e);
}

/**
 * Handle camera dragging
 */
function dragCamera(e) {
    if (!isDraggingCamera || !draggedCamera) return;
    
    // Update camera position
    draggedCamera.position = e.latlng;
    
    // Update the visual elements
    draggedCamera.ndCentre.setLatLng(e.latlng);
    renderCam(draggedCamera);
    
    // Update the tools panel if this is the current camera
    if (currentCam === draggedCamera) {
        updatePositionDisplay(draggedCamera);
    }
    
    L.DomEvent.stopPropagation(e);
    L.DomEvent.preventDefault(e);
}

/**
 * End camera dragging
 */
function endCameraDrag(e) {
    if (!isDraggingCamera) return;
    
    isDraggingCamera = false;
    draggedCamera = null;
    dragStartPos = null;
    
    // Re-enable map dragging
    map.dragging.enable();
    
    // Remove visual feedback
    document.body.classList.remove('dragging-camera');
    
    // Reset cursor for all camera centers
    cameras.forEach(function(cam) {
        if (cam.ndCentre.getElement()) {
            cam.ndCentre.getElement().style.cursor = 'grab';
        }
    });
}

/**
 * Update position display in tools panel
 */
function updatePositionDisplay(cam) {
    var positionElements = toolsEl.querySelectorAll('br');
    if (positionElements.length >= 2) {
        // Find the position text and update it
        var nameInput = document.getElementById('fld-name');
        if (nameInput && nameInput.nextSibling && nameInput.nextSibling.nextSibling) {
            nameInput.nextSibling.nextSibling.textContent = cam.position.lat.toFixed(6);
            nameInput.nextSibling.nextSibling.nextSibling.textContent = cam.position.lng.toFixed(6);
        }
    }
}

function calcFov(sensorSize, focalLength) {
    return Math.degrees(2 * Math.atan(sensorSize / (2.0 * focalLength)));
}

/**
 * Set the current camera in the tools panel
 */
function setCurrent(cam) {
    // Build dropdown options for other cameras
    var otherCameras = cameras.filter(function(c) { return c !== cam; });
    var dropdownOptions = '';
    if (otherCameras.length > 0) {
        dropdownOptions = '<option value="">Select camera to copy from...</option>';
        otherCameras.forEach(function(c) {
            dropdownOptions += `<option value="${cameras.indexOf(c)}">${c.name}</option>`;
        });
    }
    
    toolsEl.innerHTML = `
    Name: <input type="text" id="fld-name" value="${cam.name}" style="width: 200px; margin-bottom: 10px;"><br>
    ${cam.position.lat.toFixed(6)}<br>${cam.position.lng.toFixed(6)}
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
        <br><br>
        Copy from camera:<br>
        <select id="copy-camera-dropdown" style="width: 200px; margin-bottom: 10px;" ${otherCameras.length === 0 ? 'disabled' : ''}>
            ${otherCameras.length === 0 ? '<option value="">No other cameras</option>' : dropdownOptions}
        </select><br>
        <button id="copy-specs-btn" style="padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; margin-right: 10px;" ${otherCameras.length === 0 ? 'disabled' : ''}>Copy Specs</button>
        <button id="delete-camera-btn" style="padding: 5px 10px; background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete Camera</button>
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

    // Add copy specs functionality
    if (otherCameras.length > 0) {
        document.getElementById('copy-specs-btn').addEventListener('click', function() {
            var selectedIndex = document.getElementById('copy-camera-dropdown').value;
            if (selectedIndex !== '') {
                var sourceCam = cameras[parseInt(selectedIndex)];
                copySpecs(cam, sourceCam);
            }
        });
    }

    // Add delete camera functionality
    document.getElementById('delete-camera-btn').addEventListener('click', function() {
        deleteCamera(cam);
    });

    currentCam = cam;
}

function renderCam(cam) {
    var coords = buildPolyCoords(cam.position, cam.angle, cam.fov, cam.range);
    cam.ndPolygon.setLatLngs(coords);
}

/**
 * Copy specs from source camera to target camera (FOV, range, and notes only)
 */
function copySpecs(targetCam, sourceCam) {
    // Copy the specs (but not position or angle)
    targetCam.fov = sourceCam.fov;
    targetCam.range = sourceCam.range;
    targetCam.notes = sourceCam.notes;
    
    // Re-render the camera with new specs
    renderCam(targetCam);
    
    // Refresh the current camera display to show updated values
    setCurrent(targetCam);
}

/**
 * Delete a camera with confirmation
 */
function deleteCamera(cam) {
    var confirmMessage = `Are you sure you want to delete "${cam.name}"?\n\nThis action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
        // Remove the camera from the map
        map.removeLayer(cam.ndPolygon);
        map.removeLayer(cam.ndCentre);
        
        // Remove from cameras array
        var index = cameras.indexOf(cam);
        if (index > -1) {
            cameras.splice(index, 1);
        }
        
        // Clear the tools panel if this was the current camera
        if (currentCam === cam) {
            currentCam = null;
            toolsEl.innerHTML = '<p>Camera deleted.<br>Click on a camera or add a new one by clicking on the map.</p>';
        }
        
        // If this was a dragged camera, clear drag state
        if (draggedCamera === cam) {
            endCameraDrag();
        }
        
        // Renumber remaining cameras if desired (optional)
        renumberCameras();
    }
}

/**
 * Renumber cameras to maintain sequential numbering after deletion
 */
function renumberCameras() {
    cameras.forEach(function(cam, index) {
        // Only renumber if it's a default name (starts with "Camera ")
        if (cam.name.startsWith('Camera ')) {
            cam.name = 'Camera ' + (index + 1);
        }
    });
    
    // If current camera is selected and has a default name, update the display
    if (currentCam && currentCam.name.startsWith('Camera ')) {
        var nameInput = document.getElementById('fld-name');
        if (nameInput) {
            nameInput.value = currentCam.name;
        }
    }
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
                
                ndPolygon.on('click', function(e) { 
                    if (!isDraggingCamera) {
                        L.DomEvent.stopPropagation(e); 
                        setCurrent(cam);
                    }
                });
                
                ndCentre.on('click', function(e) { 
                    if (!isDraggingCamera) {
                        L.DomEvent.stopPropagation(e); 
                        setCurrent(cam);
                    }
                });
                
                // Add drag functionality to the center circle
                ndCentre.on('mousedown', function(e) {
                    startCameraDrag(cam, e);
                });
                
                // Add visual feedback for draggable cameras
                if (ndCentre.getElement()) {
                    ndCentre.getElement().classList.add('camera-draggable');
                }
                
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
    // Add global mouse event listeners for camera dragging
    map.on('mousemove', dragCamera);
    map.on('mouseup', endCameraDrag);

    // Handle case where mouse leaves the map during drag
    map.getContainer().addEventListener('mouseleave', endCameraDrag);

    window.map = map;
    initSaveLoad();
}


init();
