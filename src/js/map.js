import L from 'leaflet';
import { showToast } from './utils.js';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

let map;
let marker;
let locating = false;
const FALLBACK_LAT = 40.5239401;
const FALLBACK_LNG = 72.3074326;

// Loading overlay element
let loadingOverlay = null;

function createLoadingOverlay(container) {
    const overlay = document.createElement('div');
    overlay.className = 'absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-[1000] rounded-xl';
    overlay.id = 'map-loading-overlay';
    overlay.innerHTML = `
        <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
        <p class="text-xs text-black font-bold">Joylashuv aniqlanmoqda...</p>
    `;
    container.style.position = 'relative';
    container.appendChild(overlay);
    return overlay;
}

function showMapLoading(container) {
    if (!loadingOverlay) {
        loadingOverlay = createLoadingOverlay(container);
    }
    loadingOverlay.classList.remove('hidden');
}

function hideMapLoading() {
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

export function initMap(elementId, onClickCallback) {
    if (map) return map;

    const container = document.getElementById(elementId)?.parentElement;

    map = L.map(elementId).setView([FALLBACK_LAT, FALLBACK_LNG], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM'
    }).addTo(map);

    // Locate button
    const findMeBtn = L.Control.extend({
        onAdd: function () {
            const btn = L.DomUtil.create('button', 'locate-btn');
            btn.innerHTML = '📍 Joylashuvni Aniqlash';
            btn.style.cssText = `
                padding: 8px 12px;
                background: white;
                border: 2px solid #2b7cee;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                color: #2b7cee;
                font-size: 12px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            `;

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                locateUser(onClickCallback, container);
            };
            return btn;
        },
        onRemove: function () { }
    });
    new findMeBtn({ position: 'topright' }).addTo(map);

    // Click to set location
    map.on('click', function (e) {
        const { lat, lng } = e.latlng;
        setMarker(lat, lng, onClickCallback);
        showToast("Joylashuv belgilandi ✅", 'success');
    });

    // Auto-locate on init
    locateUser(onClickCallback, container);

    return map;
}

function setMarker(lat, lng, callback) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng]).addTo(map);
    }
    if (callback) callback(lat, lng);
}

function locateUser(callback, container) {
    if (locating) return;
    locating = true;

    if (!navigator.geolocation) {
        showToast("Geolokatsiya qurilmada yo'q", 'error');
        locating = false;
        return;
    }

    // Show loading on map
    if (container) showMapLoading(container);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            locating = false;
            hideMapLoading();

            const { latitude, longitude } = position.coords;
            map.flyTo([latitude, longitude], 16);
            setMarker(latitude, longitude, callback);
            showToast("Joylashuv topildi! ✅", 'success');
        },
        (error) => {
            locating = false;
            hideMapLoading();

            console.warn("Geo error:", error);

            if (error.code === 1) {
                // Permission denied - show dialog to retry
                showLocationPermissionDialog(callback, container);
            } else if (error.code === 2) {
                showToast("Joylashuv signali yo'q. Qaytadan urinib ko'ring.", 'error');
            } else if (error.code === 3) {
                showToast("Joylashuv vaqti tugadi. Qaytadan urinib ko'ring.", 'error');
            } else {
                showToast("Joylashuvni aniqlab bo'lmadi. Xaritadan tanlang.", 'error');
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

function showLocationPermissionDialog(callback, container) {
    const existing = document.getElementById('location-permission-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'location-permission-dialog';
    dialog.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm overflow-y-auto py-4';
    dialog.innerHTML = `
        <div style="background: #e0e5ec; box-shadow: 6px 6px 12px #b8bec7, -6px -6px 12px #ffffff;" class="p-6 rounded-3xl text-center max-w-md mx-4">
            <div class="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-amber-500 text-3xl">location_off</span>
            </div>
            <h3 class="text-lg font-bold text-slate-800 mb-2">Joylashuv ruxsati kerak</h3>
            <p class="text-black text-sm mb-4">Brauzeringizda joylashuv ruxsatini yoqing:</p>
            
            <div class="text-left bg-white/50 rounded-xl p-4 mb-4 text-xs text-black space-y-2">
                <p class="font-bold text-black">📱 Telefondan:</p>
                <p>1. Brauzer manzil qatorida 🔒 belgisini bosing</p>
                <p>2. "Joylashuv" yoki "Location" ni tanlang</p>
                <p>3. "Ruxsat berish" ni bosing</p>
                
                <p class="font-bold text-black pt-2">💻 Kompyuterdan:</p>
                <p>1. Manzil qatori chap tomonidagi 🔒 belgisini bosing</p>
                <p>2. "Sayt sozlamalari" → "Joylashuv" → "Ruxsat berish"</p>
            </div>
            
            <p class="text-[10px] text-black mb-4">Yoki xaritadan joylashuvni qo'lda belgilashingiz mumkin</p>
            
            <div class="flex gap-3">
                <button onclick="this.closest('#location-permission-dialog').remove()" class="flex-1 py-3 bg-slate-200 text-black font-bold rounded-xl hover:bg-slate-300 transition text-sm">Bekor</button>
                <button id="retry-location-btn" class="flex-1 py-3 bg-primary text-white font-bold rounded-xl hover:brightness-110 transition shadow-lg text-sm">Qayta urinish</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('retry-location-btn').onclick = () => {
        dialog.remove();
        locateUser(callback, container);
    };
}


export function setMapLocation(lat, lng) {
    if (map) {
        map.setView([lat, lng], 15);
        setMarker(lat, lng, null);
    }
}

// Check if location is set
export function hasLocation() {
    return marker !== null && marker !== undefined;
}
