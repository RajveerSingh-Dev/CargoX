import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { PathLayer, ScatterplotLayer } from '@deck.gl/layers';
import { LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css'; 

const SHIP_MODEL_URL = './ship.glb'; 

const VOYAGE_PATH = [
  [88.06, 22.02], 
  [88.00, 21.60], 
  [87.50, 20.80], 
  [86.67, 20.26]  
];

const ROUTE_DATA = [{ path: VOYAGE_PATH, color: [31, 208, 169] }];

const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.8 });
const dirLight = new DirectionalLight({ 
  color: [255, 255, 255], 
  intensity: 1.5,
  direction: [-1, -2, -3]
});
const lightingEffect = new LightingEffect({ ambientLight, dirLight });

// NEW: A custom MapLibre style object that loads real satellite imagery
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
    }
  },
  layers: [
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 19
    }
  ]
};

export default function ShipMap() {
  const [hoverInfo, setHoverInfo] = useState(null);
  const [voyageProgress, setVoyageProgress] = useState(0);
  const [currentZoom, setCurrentZoom] = useState(7.5);

  useEffect(() => {
    let animationFrame;
    const animate = () => {
      setVoyageProgress(prev => {
        const nextProgress = prev + 0.00003; 
        return nextProgress >= 1 ? 0 : nextProgress;
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const pathLen = VOYAGE_PATH.length - 1;
  const exactIndex = voyageProgress * pathLen;
  const currentIndex = Math.floor(exactIndex);
  const fraction = exactIndex - currentIndex;

  let currentPos = VOYAGE_PATH[pathLen];
  let currentYaw = 0;

  if (currentIndex < pathLen) {
    const p1 = VOYAGE_PATH[currentIndex];
    const p2 = VOYAGE_PATH[currentIndex + 1];
    
    currentPos = [
      p1[0] + (p2[0] - p1[0]) * fraction,
      p1[1] + (p2[1] - p1[1]) * fraction,
      0
    ];
    
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    currentYaw = (Math.atan2(dx, dy) * 180) / Math.PI;
  }

  const modelYaw = -currentYaw + 0;

  const dynamicVesselData = [
    { 
      id: 'active-vessel', 
      position: currentPos, 
      name: 'CargoX Vessel 404', 
      orientation: [0, modelYaw, 90] 
    }
  ];

  const ZOOM_THRESHOLD = 9.5; 

  const shipLayer = new ScenegraphLayer({
    id: 'scenegraph-layer',
    data: dynamicVesselData,
    scenegraph: SHIP_MODEL_URL,
    getPosition: d => d.position,
    getOrientation: d => d.orientation,
    sizeScale: 100, 
    getScale: [0.2, 0.2, 0.2], 
    pickable: true,
    visible: currentZoom >= ZOOM_THRESHOLD,
    onHover: info => setHoverInfo(info),
    _lighting: 'pbr',
  });

  const trackerLayer = new ScatterplotLayer({
    id: 'tracker-layer',
    data: dynamicVesselData,
    getPosition: d => d.position,
    getFillColor: [255, 180, 84], 
    getLineColor: [255, 255, 255],
    lineWidthMinPixels: 2,
    getRadius: 1000, 
    radiusMinPixels: 6,
    radiusMaxPixels: 12,
    pickable: true,
    visible: currentZoom < ZOOM_THRESHOLD,
    onHover: info => setHoverInfo(info),
  });

  const seaRouteLayer = new PathLayer({
    id: 'sea-route-layer',
    data: ROUTE_DATA,
    getPath: d => d.path,
    getColor: d => d.color,
    widthMinPixels: 3, 
    getWidth: 200, 
  });

  return (
    <div className="relative w-full bg-slate-950" style={{ width: '100%', height: '100%' }}>
      <DeckGL
        initialViewState={{ longitude: 87.2, latitude: 21.1, zoom: 7.5, pitch: 45, bearing: -10 }}
        controller={true}
        onViewStateChange={({ viewState }) => setCurrentZoom(viewState.zoom)}
        layers={[seaRouteLayer, trackerLayer, shipLayer]}
        effects={[lightingEffect]}
      >
        {/* NEW: Replaced the static dark style URL with our custom satellite object */}
        <Map mapStyle={SATELLITE_STYLE} />
        
        {hoverInfo && hoverInfo.object && (
          <div style={{
            position: 'absolute',
            zIndex: 1,
            pointerEvents: 'none',
            left: hoverInfo.x + 15,
            top: hoverInfo.y + 15,
            backgroundColor: 'rgba(5, 14, 26, 0.9)',
            border: '1px solid rgba(126, 178, 255, 0.3)',
            padding: '10px 14px',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}>
            <b style={{ color: '#ffb454' }}>{hoverInfo.object.name}</b>
            <br/>Status: Underway to Paradip
            <br/>Speed: 11.2 Knots
          </div>
        )}
      </DeckGL>
    </div>
  );
}