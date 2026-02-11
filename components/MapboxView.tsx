import React, { useEffect, useRef, useState } from 'react';

interface Telemetry {
    lat: number;
    lng: number;
    alt: number | null;
    speed: number | null;
    heading: number | null;
    accuracy: number | null;
}

export const MapboxView: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const [tokenMissing, setTokenMissing] = useState(false);
    const [style, setStyle] = useState<'dark' | 'satellite'>('dark');
    const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    // Network status listener
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Geolocation Tracker (The "Blue Force" Tracker)
    useEffect(() => {
        if (!navigator.geolocation) return;
        
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setTelemetry({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    alt: pos.coords.altitude,
                    speed: pos.coords.speed,
                    heading: pos.coords.heading,
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => console.error("GPS Signal Lost:", err),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Initialize Map
    useEffect(() => {
        const config = JSON.parse(localStorage.getItem('hugh_system_config') || '{}');
        if (!config.mapboxToken) {
            setTokenMissing(true);
            return;
        }

        if (!mapRef.current && mapContainer.current && window.mapboxgl) {
            window.mapboxgl.accessToken = config.mapboxToken;
            
            const map = new window.mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/dark-v11',
                center: [-74.5, 40], // Initial fallback
                zoom: 12,
                pitch: 60, // Aggressive pitch for 3D view
                bearing: 0,
                antialias: true
            });

            mapRef.current = map;

            map.on('load', () => {
                // 1. Add 3D Terrain (DEM)
                map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    'tileSize': 512,
                    'maxzoom': 14
                });
                map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });

                // 2. Add Sky Layer (Atmosphere)
                map.addLayer({
                    'id': 'sky',
                    'type': 'sky',
                    'paint': {
                        'sky-type': 'atmosphere',
                        'sky-atmosphere-sun': [0.0, 0.0],
                        'sky-atmosphere-sun-intensity': 15
                    }
                });

                // 3. Add 3D Buildings
                map.addLayer({
                    'id': '3d-buildings',
                    'source': 'composite',
                    'source-layer': 'building',
                    'filter': ['==', 'extrude', 'true'],
                    'type': 'fill-extrusion',
                    'minzoom': 15,
                    'paint': {
                        'fill-extrusion-color': '#22c55e', // Highland Green hint
                        'fill-extrusion-height': ['get', 'height'],
                        'fill-extrusion-base': ['get', 'min_height'],
                        'fill-extrusion-opacity': 0.3
                    }
                });

                // 4. Add Native Geolocate Control (The Puck)
                const geolocate = new window.mapboxgl.GeolocateControl({
                    positionOptions: { enableHighAccuracy: true },
                    trackUserLocation: true,
                    showUserHeading: true
                });
                map.addControl(geolocate, 'bottom-right');
                
                // Auto-trigger location on load
                setTimeout(() => geolocate.trigger(), 1000);
            });
        }

        return () => {
            // Cleanup if needed
        }
    }, []);

    // Handle Style Switching
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;
        const styleUrl = style === 'satellite' 
            ? 'mapbox://styles/mapbox/satellite-streets-v12' 
            : 'mapbox://styles/mapbox/dark-v11';
        
        // Changing style removes layers, so we need to re-add them
        map.setStyle(styleUrl);
        map.once('style.load', () => {
            // Re-add sources and layers that might be lost on style switch
            if (!map.getSource('mapbox-dem')) {
                map.addSource('mapbox-dem', {
                    'type': 'raster-dem',
                    'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                    'tileSize': 512,
                    'maxzoom': 14
                });
                map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
            }
            // Re-add buildings if in dark mode (satellite usually has them baked or looks messy)
            if (style === 'dark' && !map.getLayer('3d-buildings')) {
                 map.addLayer({
                    'id': '3d-buildings',
                    'source': 'composite',
                    'source-layer': 'building',
                    'filter': ['==', 'extrude', 'true'],
                    'type': 'fill-extrusion',
                    'minzoom': 15,
                    'paint': {
                        'fill-extrusion-color': '#22c55e',
                        'fill-extrusion-height': ['get', 'height'],
                        'fill-extrusion-base': ['get', 'min_height'],
                        'fill-extrusion-opacity': 0.3
                    }
                });
            }
        });
    }, [style]);

    if (tokenMissing) {
        return (
            <div className="h-full flex items-center justify-center bg-grizzly-900">
                <div className="text-center text-gray-500">
                    <span className="material-icons-outlined text-6xl mb-4">map</span>
                    <p className="text-xl font-bold">Harbormaster Offline</p>
                    <p>Please provide a Mapbox Token in the Architecture tab.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full relative bg-black">
            <div ref={mapContainer} className="w-full h-full" />
            
            {/* --- ATAK-style HUD Overlay --- */}
            
            {/* Top Bar: Telemetry */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none flex justify-between items-start">
                <div className="flex flex-col space-y-1">
                    <h2 className="text-xl font-bold text-white font-mono flex items-center">
                        <span className="material-icons-outlined mr-2 text-highland-500">public</span>
                        SITUATIONAL AWARENESS
                    </h2>
                    <div className="flex items-center space-x-4 text-xs font-mono text-gray-400">
                        <span>SAT: {isOffline ? 'OFFLINE' : 'CONNECTED'}</span>
                        <span className="text-highland-500">GPS: {telemetry ? 'LOCKED' : 'SEARCHING...'}</span>
                    </div>
                </div>
                
                {/* Coordinates Readout */}
                <div className="text-right font-mono text-xs text-highland-400 bg-black/60 p-2 rounded border border-gray-700 backdrop-blur-md">
                    <div>LAT: {telemetry?.lat.toFixed(5) || '---'}</div>
                    <div>LNG: {telemetry?.lng.toFixed(5) || '---'}</div>
                    <div className="text-gray-500 mt-1">ACC: ±{telemetry?.accuracy?.toFixed(0) || '-'}m</div>
                </div>
            </div>

            {/* Bottom Bar: Tactical Metrics */}
            <div className="absolute bottom-8 left-4 right-4 flex justify-between items-end pointer-events-none">
                <div className="flex gap-4">
                    <div className="bg-black/60 backdrop-blur border border-gray-700 p-2 rounded min-w-[80px] text-center">
                        <div className="text-[10px] text-gray-500 uppercase">Speed</div>
                        <div className="text-xl font-bold text-white font-mono">
                            {telemetry?.speed ? (telemetry.speed * 3.6).toFixed(1) : '0.0'}
                            <span className="text-xs ml-1 text-gray-400">km/h</span>
                        </div>
                    </div>
                    <div className="bg-black/60 backdrop-blur border border-gray-700 p-2 rounded min-w-[80px] text-center">
                        <div className="text-[10px] text-gray-500 uppercase">Alt</div>
                        <div className="text-xl font-bold text-white font-mono">
                            {telemetry?.alt ? telemetry.alt.toFixed(0) : '0'}
                            <span className="text-xs ml-1 text-gray-400">m</span>
                        </div>
                    </div>
                    <div className="bg-black/60 backdrop-blur border border-gray-700 p-2 rounded min-w-[80px] text-center">
                        <div className="text-[10px] text-gray-500 uppercase">Hdg</div>
                        <div className="text-xl font-bold text-white font-mono">
                            {telemetry?.heading ? telemetry.heading.toFixed(0) : '0'}°
                        </div>
                    </div>
                </div>

                {/* Layer Controls (Pointer Events Enabled) */}
                <div className="pointer-events-auto flex flex-col gap-2">
                    <button 
                        onClick={() => setStyle(s => s === 'dark' ? 'satellite' : 'dark')}
                        className={`p-3 rounded-full shadow-lg border transition-all ${style === 'satellite' ? 'bg-highland-600 border-highland-400 text-white' : 'bg-grizzly-800 border-gray-600 text-gray-400 hover:text-white'}`}
                        title="Toggle Satellite Imagery"
                    >
                        <span className="material-icons-outlined">satellite_alt</span>
                    </button>
                </div>
            </div>

            {/* Offline Warning Overlay */}
            {isOffline && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-red-900/90 border border-red-500 text-white px-6 py-4 rounded-xl shadow-2xl backdrop-blur text-center pointer-events-none">
                    <span className="material-icons-outlined text-4xl mb-2">wifi_off</span>
                    <h3 className="text-lg font-bold">OFFLINE MODE</h3>
                    <p className="text-xs opacity-80">Using cached vector tiles.</p>
                </div>
            )}
        </div>
    );
};