// @ts-nocheck
"use client";

import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

const SHIP_MODEL_URL = '/ship.glb';

// Gladstone (Australia) ➔ Paradip (India) ~4,600 nm
const VOYAGE_PATH: [number, number][] = [
  [151.25, -23.84],
  [153.20, -19.50],
  [145.50, -11.00],
  [135.20, -10.20],
  [124.50, -10.80],
  [112.00, -9.50],
  [98.00, -2.50],
  [93.80, 6.20],
  [88.80, 14.50],
  [86.67, 20.26]
];

const TOTAL_VOYAGE_DAYS = 15.8;
const ROUTE_DATA = [{ path: VOYAGE_PATH, color: [31, 208, 169] }];

const PORT_LOCATIONS = [
  { id: 'origin', name: 'Gladstone Port', country: 'Australia', coordinates: [151.25, -23.84], role: 'Load Port (RGT Coal Terminal)' },
  { id: 'chokepoint-1', name: 'Torres Strait', country: 'Australia / PNG', coordinates: [142.50, -10.60], role: 'Shallow Draft Chokepoint' },
  { id: 'chokepoint-2', name: 'Nicobar Channel', country: 'Indian Ocean Corridor', coordinates: [93.80, 6.20], role: 'Bay of Bengal Gate' },
  { id: 'destination', name: 'Paradip Port', country: 'India', coordinates: [86.67, 20.26], role: 'Discharge Berth (IOTL / Steelmaker Intake)' }
];

const COUNTRY_LABELS = [
  { name: 'AUSTRALIA', coordinates: [134.0, -24.5] },
  { name: 'INDONESIA', coordinates: [118.0, -2.5] },
  { name: 'INDIA', coordinates: [79.5, 21.0] },
  { name: 'MALAYSIA', coordinates: [102.5, 4.0] },
  { name: 'SRI LANKA', coordinates: [80.7, 7.8] }
];

const ambientLight = new AmbientLight({ color: [255, 255, 255], intensity: 0.9 });
const dirLight = new DirectionalLight({
  color: [255, 255, 255],
  intensity: 1.6,
  direction: [-1, -2, -3]
});
const lightingEffect = new LightingEffect({ ambientLight, dirLight });

const SATELLITE_STYLE: any = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256
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
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [voyageProgress, setVoyageProgress] = useState<number>(0.42);
  const [currentZoom, setCurrentZoom] = useState<number>(3.6);

  useEffect(() => {
    let animationFrame: number;
    const animate = () => {
      setVoyageProgress((prev) => {
        const nextProgress = prev + 0.000001;
        return nextProgress >= 1 ? 0 : nextProgress;
      });
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const pathLen = VOYAGE_PATH.length - 1;
  const exactIndex = voyageProgress * pathLen;
  const currentIndex = Math.min(Math.floor(exactIndex), pathLen - 1);
  const fraction = exactIndex - currentIndex;

  const p1 = VOYAGE_PATH[currentIndex];
  const p2 = VOYAGE_PATH[currentIndex + 1];

  const currentPos: [number, number, number] = [
    p1[0] + (p2[0] - p1[0]) * fraction,
    p1[1] + (p2[1] - p1[1]) * fraction,
    0
  ];

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1]; 
  const currentYaw = (Math.atan2(dx, dy) * 354) / Math.PI;

  const elapsedDays = (voyageProgress * TOTAL_VOYAGE_DAYS).toFixed(1);
  const remainingDays = (TOTAL_VOYAGE_DAYS - Number(elapsedDays)).toFixed(1);

  const dynamicVesselData = [
    {
      id: 'active-vessel',
      position: currentPos,
      name: 'CargoX Iron Apex (Capesize)',
      dwt: '165,000 MT (98.4% Laden)',
      commodity: 'Prime Hard Coking Coal',
      origin: 'Gladstone, Australia',
      destination: 'Paradip, India',
      speed: '12.4 Knots',
      elapsedDays,
      remainingDays,
      progressPct: Math.round(voyageProgress * 100),
      orientation: [0, -currentYaw, 0]
    }
  ];

  const ZOOM_THRESHOLD = 7.0;

  const shipLayer = new ScenegraphLayer({
    id: 'scenegraph-layer',
    data: dynamicVesselData,
    scenegraph: SHIP_MODEL_URL,
    getPosition: (d: any) => d.position,
    getOrientation: (d: any) => d.orientation,
    sizeScale: 90,
    getScale: [0.35, 0.95, 0.35],
    pickable: true,
    visible: currentZoom >= ZOOM_THRESHOLD,
    onHover: (info: any) => setHoverInfo(info),
    _lighting: 'pbr'
  });

  const trackerLayer = new ScatterplotLayer({
    id: 'tracker-layer',
    data: dynamicVesselData,
    getPosition: (d: any) => d.position,
    getFillColor: [299, 16, 59],
    getLineColor: [255, 255, 255],
    lineWidthMinPixels: 2.5,
    stroked: true,
    getRadius: 8000,
    radiusMinPixels: 7,
    radiusMaxPixels: 14,
    pickable: true,
    visible: currentZoom < ZOOM_THRESHOLD,
    onHover: (info: any) => setHoverInfo(info)
  });

  const seaRouteLayer = new PathLayer({
    id: 'sea-route-layer',
    data: ROUTE_DATA,
    getPath: (d: any) => d.path,
    getColor: (d: any) => d.color,
    widthMinPixels: 2.5,
    getWidth: 500
  });

  const portDotsLayer = new ScatterplotLayer({
    id: 'port-dots-layer',
    data: PORT_LOCATIONS,
    getPosition: (d: any) => d.coordinates,
    getFillColor: (d: any) =>
      d.id === 'destination' ? [251, 94, 126] : d.id === 'origin' ? [43, 217, 199] : [242, 166, 59],
    getLineColor: [255, 255, 255],
    lineWidthMinPixels: 2,
    stroked: true,
    getRadius: 10000,
    radiusMinPixels: 5,
    radiusMaxPixels: 9,
    pickable: true,
    onHover: (info: any) => setHoverInfo(info)
  });

  const portLabelsLayer = new TextLayer({
    id: 'port-labels-layer',
    data: PORT_LOCATIONS,
    getPosition: (d: any) => d.coordinates,
    getText: (d: any) => `${d.name} (${d.country})`,
    getSize: 11,
    getColor: [255, 255, 255, 240],
    getTextAnchor: 'start',
    getAlignmentBaseline: 'center',
    getPixelOffset: [12, 0],
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 600,
    outlineWidth: 2.5,
    outlineColor: [5, 14, 26, 255],
    background: true,
    backgroundColor: [5, 14, 26, 210],
    backgroundPadding: [6, 3],
    pickable: false
  });

  const countryLabelsLayer = new TextLayer({
    id: 'country-labels-layer',
    data: COUNTRY_LABELS,
    getPosition: (d: any) => d.coordinates,
    getText: (d: any) => d.name,
    getSize: 13,
    getColor: [170, 190, 215, 160],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    fontFamily: 'Inter, monospace, sans-serif',
    fontWeight: 800,
    outlineWidth: 3,
    outlineColor: [5, 14, 26, 180],
    pickable: false
  });

  return (
    <div className="relative w-full bg-slate-950" style={{ width: '100%', height: '100%' }}>
      <DeckGL
        initialViewState={{
          longitude: 114.0,
          latitude: 1.0,
          zoom: 3.5,
          pitch: 35,
          bearing: -4
        }}
        controller={true}
        onViewStateChange={(e: any) => {
          if (e?.viewState?.zoom !== undefined) {
            setCurrentZoom(e.viewState.zoom);
          }
        }}
        layers={[seaRouteLayer, portDotsLayer, portLabelsLayer, countryLabelsLayer, trackerLayer, shipLayer]}
        effects={[lightingEffect]}
      >
        <Map mapStyle={SATELLITE_STYLE} />

        {hoverInfo && hoverInfo.object && (
          <div
            style={{
              position: 'absolute',
              zIndex: 20,
              pointerEvents: 'none',
              left: (hoverInfo.x || 0) + 18,
              top: (hoverInfo.y || 0) + 18,
              backgroundColor: 'rgba(5, 14, 26, 0.94)',
              border: '1px solid rgba(242, 166, 59, 0.35)',
              padding: '12px 16px',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '12px',
              lineHeight: 1.55,
              boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
              minWidth: '240px'
            }}
          >
            {hoverInfo.object.id === 'active-vessel' ? (
              <>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', marginBottom: '6px' }}>
                  <b style={{ color: '#f2a63b', fontSize: '13px' }}>{hoverInfo.object.name}</b>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>En route to East Coast India</div>
                </div>
                <div><b>Cargo Weight:</b> <span style={{ color: '#2bd9c7' }}>{hoverInfo.object.dwt}</span></div>
                <div><b>Commodity:</b> {hoverInfo.object.commodity}</div>
                <div><b>Corridor:</b> {hoverInfo.object.origin} ➔ {hoverInfo.object.destination}</div>
                <div><b>Voyage Progress:</b> Day {hoverInfo.object.elapsedDays} of {TOTAL_VOYAGE_DAYS}d ({hoverInfo.object.progressPct}%)</div>
                <div><b>ETA Paradip:</b> {hoverInfo.object.remainingDays} days</div>
                <div><b>Steaming Speed:</b> {hoverInfo.object.speed}</div>
              </>
            ) : (
              <>
                <b style={{ color: '#2bd9c7', fontSize: '13px' }}>{hoverInfo.object.name}</b>
                <div style={{ color: '#94a3b8' }}>Country: {hoverInfo.object.country}</div>
                <div>Role: {hoverInfo.object.role}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Coords: {hoverInfo.object.coordinates[1].toFixed(2)}°, {hoverInfo.object.coordinates[0].toFixed(2)}°
                </div>
              </>
            )}
          </div>
        )}
      </DeckGL>
    </div>
  );
}