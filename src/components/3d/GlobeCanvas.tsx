import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GlobeMetrics, HandGestureData, LayerType } from "../../types";
import {
  generateEarthSpecularCanvas,
  generateTemperatureTextureCanvas,
  generatePressureTextureCanvas,
  generateSeaLevelTextureCanvas,
  generateUVTextureCanvas,
  calculateGlobeMetrics,
} from "../../utils/climateData";
import {
  latLngToVector3,
  convertPointToLatLng,
  raycastGlobeHit,
  applyDirectRotation,
  applySteadyZoom,
  processWindParticles,
} from "../../utils/globePhysics";

interface GlobeCanvasProps {
  activeLayer: LayerType;
  seaLevelRiseM: number;
  timeOffsetHours: number;
  gestureData: HandGestureData;
  selectedMetrics: GlobeMetrics;
  onSelectMetrics: (metrics: GlobeMetrics) => void;
  onLayerChangeRequest: () => void;
  isPinLocked: boolean;
  onTogglePinLock: () => void;
}

/**
 * Creates a standard semi-transparent sphere overlay mesh for climate layers with depthWrite disabled.
 */
function createOverlayMesh(
  geometry: THREE.BufferGeometry,
  texture: THREE.Texture,
  initialOpacity: number,
  blending = THREE.NormalBlending
): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: initialOpacity,
    depthWrite: false,
    blending,
  });
  return new THREE.Mesh(geometry, mat);
}

/**
 * Configures soft, volumetric atmospheric cloud layer using CDN map with soft alpha blending.
 */
function setVolumetricAtmosphere(
  textureLoader: THREE.TextureLoader,
  globeGroup: THREE.Group,
  globeRadius: number,
  initialOpacity: number
): THREE.Mesh {
  const cloudTexture = textureLoader.load(
    "https://unpkg.com/three-globe/example/img/earth-clouds.png",
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    }
  );

  const cloudsGeo = new THREE.SphereGeometry(globeRadius + 0.08, 64, 64);
  const cloudsMat = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: initialOpacity,
    roughness: 0.85,
    depthWrite: false, // Prevents depth buffer artifacts & z-fighting with the globe surface
    blending: THREE.NormalBlending,
  });

  const cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
  globeGroup.add(cloudsMesh);
  return cloudsMesh;
}

/**
 * Creates outer atmospheric Fresnel glow shader mesh.
 */
function createAtmosphereGlow(scene: THREE.Scene, globeRadius: number): THREE.Mesh {
  const atmosphereGeo = new THREE.SphereGeometry(globeRadius + 0.35, 64, 64);
  const atmosphereMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.65 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
        gl_FragColor = vec4(0.18, 0.58, 0.92, 1.0) * intensity * 0.22;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
  });
  const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
  scene.add(atmosphereMesh);
  return atmosphereMesh;
}

/**
 * Generates background starfield points.
 */
function createStarfield(scene: THREE.Scene, count = 2000): THREE.Points {
  const starsGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(count * 3);
  for (let i = 0; i < count * 3; i += 3) {
    starPositions[i] = (Math.random() - 0.5) * 400;
    starPositions[i + 1] = (Math.random() - 0.5) * 400;
    starPositions[i + 2] = (Math.random() - 0.5) * 400;
  }
  starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.8,
    transparent: true,
    opacity: 0.8,
  });
  const starField = new THREE.Points(starsGeometry, starsMaterial);
  scene.add(starField);
  return starField;
}

/**
 * Generates a high-resolution, lightweight 2D Red Map Pin canvas texture for fast rendering.
 */
function generate2DPinTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, 128, 128);

  // 1. Red Target Ring at ground contact point (bottom center)
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(64, 114, 18, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#ef4444";
  ctx.stroke();

  // 2. Red Pin Head Body (Classic Teardrop Map Pin 📍)
  ctx.beginPath();
  ctx.arc(64, 42, 28, 0, Math.PI * 2);
  ctx.fillStyle = "#ef4444";
  ctx.fill();

  // Needle tail down to ground tip (64, 110)
  ctx.beginPath();
  ctx.moveTo(38, 50);
  ctx.lineTo(64, 110);
  ctx.lineTo(90, 50);
  ctx.closePath();
  ctx.fillStyle = "#ef4444";
  ctx.fill();

  // Dark Red Outline for high contrast on any terrain
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#991b1b";
  ctx.stroke();

  // White inner circle dot inside pin head
  ctx.beginPath();
  ctx.arc(64, 42, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({
  activeLayer,
  seaLevelRiseM,
  timeOffsetHours,
  gestureData,
  selectedMetrics,
  onSelectMetrics,
  onLayerChangeRequest,
  isPinLocked,
  onTogglePinLock,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References to keep state across animation loop without re-triggering React mounts
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Mesh refs for each distinct Climate Layer
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const cloudsMeshRef = useRef<THREE.Mesh | null>(null);
  const tempMeshRef = useRef<THREE.Mesh | null>(null);
  const pressureMeshRef = useRef<THREE.Mesh | null>(null);
  const seaLevelMeshRef = useRef<THREE.Mesh | null>(null);
  const uvMeshRef = useRef<THREE.Mesh | null>(null);
  const windParticlesRef = useRef<THREE.Points | null>(null);
  const pinMarkerRef = useRef<THREE.Group | null>(null);

  // Gesture debouncers
  const lastPeaceTimeRef = useRef<number>(0);
  const lastLockGestureTimeRef = useRef<number>(0);

  // Canvas textures cache
  const tempTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const pressureTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const seaLevelTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const uvTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Target opacities state machine ref for smooth lerping
  const targetOpacitiesRef = useRef({
    temperature: activeLayer === "temperature" ? 0.60 : 0.0,
    pressure: activeLayer === "pressure" ? 0.85 : 0.0,
    airflow: activeLayer === "airflow" ? 0.95 : 0.0,
    sealevel: activeLayer === "sealevel" ? 0.80 : 0.0,
    precipitation: activeLayer === "precipitation" ? 0.82 : 0.15,
    uv: activeLayer === "uv" ? 0.85 : 0.0,
  });

  // Visualization State Machine function
  const updateGlobeVisualization = (layer: LayerType) => {
    targetOpacitiesRef.current = {
      temperature: layer === "temperature" ? 0.60 : 0.0,
      pressure: layer === "pressure" ? 0.85 : 0.0,
      airflow: layer === "airflow" ? 0.95 : 0.0,
      sealevel: layer === "sealevel" ? 0.80 : 0.0,
      precipitation: layer === "precipitation" ? 0.82 : 0.15,
      uv: layer === "uv" ? 0.85 : 0.0,
    };
  };

  // Latest props kept in refs for smooth, non-restarting 60FPS animation loop
  const gestureDataRef = useRef(gestureData);
  gestureDataRef.current = gestureData;

  const isPinLockedRef = useRef(isPinLocked);
  isPinLockedRef.current = isPinLocked;

  const onTogglePinLockRef = useRef(onTogglePinLock);
  onTogglePinLockRef.current = onTogglePinLock;

  const activeLayerRef = useRef(activeLayer);
  activeLayerRef.current = activeLayer;

  const seaLevelRiseMRef = useRef(seaLevelRiseM);
  seaLevelRiseMRef.current = seaLevelRiseM;

  const timeOffsetHoursRef = useRef(timeOffsetHours);
  timeOffsetHoursRef.current = timeOffsetHours;

  const selectedMetricsRef = useRef(selectedMetrics);
  selectedMetricsRef.current = selectedMetrics;

  const onSelectMetricsRef = useRef(onSelectMetrics);
  onSelectMetricsRef.current = onSelectMetrics;

  const onLayerChangeRequestRef = useRef(onLayerChangeRequest);
  onLayerChangeRequestRef.current = onLayerChangeRequest;

  // Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color("#030712"); // Dark space background

    // Starfield particles background
    createStarfield(scene);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, (width || 1) / (height || 1), 0.1, 1000);
    camera.position.set(0, 2, 12.5);
    cameraRef.current = camera;

    // 3. Renderer (GPU pixel ratio cap enforced for high-density Retina/4K mobile screens)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width || window.innerWidth, height || window.innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Enforce full container block styles and touch-action none for responsive mobile touch dragging
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.outline = "none";

    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
    sunLight.position.set(15, 10, 15);
    scene.add(sunLight);

    const backLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    backLight.position.set(-15, -5, -15);
    scene.add(backLight);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.85;
    controls.zoomSpeed = 1.0;
    controls.minDistance = 6.2;
    controls.maxDistance = 25;
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlsRef.current = controls;

    // 6. Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // Base Earth Geometry & 2K Web-Optimized NASA Blue Marble Texture
    const globeRadius = 4.5;
    const earthGeo = new THREE.SphereGeometry(globeRadius, 64, 64);

    const textureLoader = new THREE.TextureLoader();

    // High-Definition NASA Earth Day Texture
    const earthTexture = textureLoader.load(
      "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg",
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
      }
    );
    earthTexture.colorSpace = THREE.SRGBColorSpace;

    // Surface Depth/Mountains Topology Bump Map
    const bumpTexture = textureLoader.load(
      "https://unpkg.com/three-globe/example/img/earth-topology.png",
      (tex) => {
        tex.needsUpdate = true;
      }
    );

    const specularCanvas = generateEarthSpecularCanvas();
    const specularTexture = new THREE.CanvasTexture(specularCanvas);

    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpMap: bumpTexture,
      bumpScale: 0.12,
      specularMap: specularTexture,
      specular: new THREE.Color(0x225588),
      shininess: 28,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // High-Contrast GeoJSON Country Boundaries Overlay
    fetch("https://unpkg.com/three-globe/example/img/earth-geojson-subdiv.json")
      .catch(() => fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"))
      .then((res) => res.json())
      .then((geojson) => {
        if (!globeGroupRef.current) return;
        const borderPositions: number[] = [];
        const r = globeRadius + 0.008;

        const addPolygonRings = (rings: number[][][]) => {
          for (const ring of rings) {
            for (let i = 0; i < ring.length - 1; i++) {
              const [lng1, lat1] = ring[i];
              const [lng2, lat2] = ring[i + 1];

              const p1 = latLngToVector3(lat1, lng1, r);
              const p2 = latLngToVector3(lat2, lng2, r);

              borderPositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            }
          }
        };

        const features = geojson.features || [];
        for (const feature of features) {
          if (!feature.geometry) continue;
          const { type, coordinates } = feature.geometry;
          if (type === "Polygon") {
            addPolygonRings(coordinates);
          } else if (type === "MultiPolygon") {
            for (const poly of coordinates) {
              addPolygonRings(poly);
            }
          }
        }

        if (borderPositions.length > 0) {
          const borderGeo = new THREE.BufferGeometry();
          borderGeo.setAttribute("position", new THREE.Float32BufferAttribute(borderPositions, 3));
          const borderMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.65,
          });
          const borderLines = new THREE.LineSegments(borderGeo, borderMat);
          globeGroup.add(borderLines);
        }
      })
      .catch((err) => {
        console.warn("Could not load country borders GeoJSON:", err);
      });

    // LAYER 1: Temperature Overlay Sphere (Heatmap texture with 2K color ramp)
    const tempCanvas = generateTemperatureTextureCanvas();
    const tempTexture = new THREE.CanvasTexture(tempCanvas);
    tempTextureRef.current = tempTexture;
    const tempMesh = createOverlayMesh(
      new THREE.SphereGeometry(globeRadius + 0.02, 64, 64),
      tempTexture,
      activeLayerRef.current === "temperature" ? 0.60 : 0.0
    );
    globeGroup.add(tempMesh);
    tempMeshRef.current = tempMesh;

    // LAYER 2: Barometric Pressure Overlay Sphere (Isobars + High/Low centers)
    const pressureCanvas = generatePressureTextureCanvas();
    const pressureTexture = new THREE.CanvasTexture(pressureCanvas);
    pressureTextureRef.current = pressureTexture;
    const pressureMesh = createOverlayMesh(
      new THREE.SphereGeometry(globeRadius + 0.035, 64, 64),
      pressureTexture,
      activeLayerRef.current === "pressure" ? 0.85 : 0.0
    );
    globeGroup.add(pressureMesh);
    pressureMeshRef.current = pressureMesh;

    // LAYER 3: Sea Level Rise Overlay Sphere (Pulsating Neon Cyan coastal inundation)
    const seaCanvas = generateSeaLevelTextureCanvas(seaLevelRiseMRef.current);
    const seaTexture = new THREE.CanvasTexture(seaCanvas);
    seaLevelTextureRef.current = seaTexture;
    const seaMesh = createOverlayMesh(
      new THREE.SphereGeometry(globeRadius + 0.03, 64, 64),
      seaTexture,
      activeLayerRef.current === "sealevel" ? 0.80 : 0.0
    );
    globeGroup.add(seaMesh);
    seaLevelMeshRef.current = seaMesh;

    // LAYER 4: UV & Solar Index Overlay Sphere (Golden/Yellow subsolar radial exposure glow)
    const uvCanvas = generateUVTextureCanvas(timeOffsetHoursRef.current);
    const uvTexture = new THREE.CanvasTexture(uvCanvas);
    uvTextureRef.current = uvTexture;
    const uvMesh = createOverlayMesh(
      new THREE.SphereGeometry(globeRadius + 0.045, 64, 64),
      uvTexture,
      activeLayerRef.current === "uv" ? 0.85 : 0.0
    );
    globeGroup.add(uvMesh);
    uvMeshRef.current = uvMesh;

    // LAYER 5: Volumetric Clouds & Rain Atmosphere (High-Res CDN Map with Soft Alpha Blending)
    const initialCloudOpacity = activeLayerRef.current === "precipitation" ? 0.82 : 0.15;
    const cloudsMesh = setVolumetricAtmosphere(textureLoader, globeGroup, globeRadius, initialCloudOpacity);
    cloudsMeshRef.current = cloudsMesh;

    // Outer Atmosphere Glow Fresnel Shader
    createAtmosphereGlow(scene, globeRadius);

    // LAYER 6: Airflow Wind Vector Particle Streamline System
    const windParticleCount = 2800;
    const windPositions = new Float32Array(windParticleCount * 3);
    const windColors = new Float32Array(windParticleCount * 3);

    for (let i = 0; i < windParticleCount; i++) {
      const lat = (Math.random() - 0.5) * 160;
      const lng = (Math.random() - 0.5) * 360;
      const r = globeRadius + 0.12 + Math.random() * 0.08;

      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);

      windPositions[i * 3] = -(r * Math.sin(phi) * Math.cos(theta));
      windPositions[i * 3 + 1] = r * Math.cos(phi);
      windPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      windColors[i * 3] = 0.2;
      windColors[i * 3 + 1] = 0.8;
      windColors[i * 3 + 2] = 1.0;
    }

    const windGeo = new THREE.BufferGeometry();
    windGeo.setAttribute("position", new THREE.BufferAttribute(windPositions, 3));
    windGeo.setAttribute("color", new THREE.BufferAttribute(windColors, 3));

    const windMat = new THREE.PointsMaterial({
      size: activeLayerRef.current === "airflow" ? 0.18 : 0.01,
      vertexColors: true,
      transparent: true,
      opacity: activeLayerRef.current === "airflow" ? 0.95 : 0.0,
      blending: THREE.AdditiveBlending,
    });
    const windParticles = new THREE.Points(windGeo, windMat);
    globeGroup.add(windParticles);
    windParticlesRef.current = windParticles;

    // 7. Red 2D Location Pin Sprite
    const pinTexture = generate2DPinTexture();
    const pinSpriteMat = new THREE.SpriteMaterial({
      map: pinTexture,
      transparent: true,
      depthTest: false,
    });
    const pinSprite = new THREE.Sprite(pinSpriteMat);
    pinSprite.center.set(0.5, 0.08);
    pinSprite.scale.set(0.48, 0.48, 1.0);

    globeGroup.add(pinSprite);
    pinMarkerRef.current = pinSprite;

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const rect = mountRef.current.getBoundingClientRect();
      const w = rect.width || window.innerWidth;
      const h = rect.height || window.innerHeight;
      if (w > 0 && h > 0) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current.setSize(w, h, false);
      }
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }
    window.addEventListener("resize", handleResize);
    requestAnimationFrame(handleResize);

    // Pointer Selection Handler
    let pointerStartPos = { x: 0, y: 0 };
    const domElem = renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      pointerStartPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerStartPos.x, e.clientY - pointerStartPos.y);
      if (moveDist > 6) return;

      if (!mountRef.current || !cameraRef.current || !globeGroupRef.current) return;
      const rect = domElem.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const sphereHit = raycastGlobeHit({ x, y }, cameraRef.current, globeGroupRef.current, pinMarkerRef.current);
      if (sphereHit) {
        const coords = convertPointToLatLng(sphereHit.point, globeGroupRef.current);
        if (coords) {
          const newMetrics = calculateGlobeMetrics(coords.lat, coords.lng, seaLevelRiseMRef.current, timeOffsetHoursRef.current);
          onSelectMetricsRef.current(newMetrics);
          onTogglePinLockRef.current();
        }
      }
    };

    domElem.addEventListener("pointerdown", onPointerDown);
    domElem.addEventListener("pointerup", onPointerUp);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      domElem.removeEventListener("pointerdown", onPointerDown);
      domElem.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      if (mountRef.current) {
        mountRef.current.innerHTML = "";
      }
    };
  }, []);

  // Trigger Visualization State Machine update whenever activeLayer prop changes
  useEffect(() => {
    updateGlobeVisualization(activeLayer);
  }, [activeLayer]);

  // Update 3D Pin Visibility & Location when selectedMetrics or isPinLocked changes
  useEffect(() => {
    if (!pinMarkerRef.current || !globeGroupRef.current) return;

    if (isPinLocked) {
      pinMarkerRef.current.visible = true;
      const globeRadius = 4.5;
      const lat = selectedMetrics.lat;
      const lng = selectedMetrics.lng;

      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);

      const x = -(globeRadius * Math.sin(phi) * Math.cos(theta));
      const y = globeRadius * Math.cos(phi);
      const z = globeRadius * Math.sin(phi) * Math.sin(theta);

      pinMarkerRef.current.position.set(x, y, z);
    } else {
      pinMarkerRef.current.visible = false;
    }
  }, [selectedMetrics, isPinLocked]);

  // Update Sea Level Texture when seaLevelRiseM changes
  useEffect(() => {
    if (seaLevelMeshRef.current && seaLevelTextureRef.current) {
      const seaCanvas = generateSeaLevelTextureCanvas(seaLevelRiseM);
      seaLevelTextureRef.current.image = seaCanvas;
      seaLevelTextureRef.current.needsUpdate = true;
    }
  }, [seaLevelRiseM]);

  // Update UV Texture when timeOffsetHours changes
  useEffect(() => {
    if (uvMeshRef.current && uvTextureRef.current) {
      const uvCanvas = generateUVTextureCanvas(timeOffsetHours);
      uvTextureRef.current.image = uvCanvas;
      uvTextureRef.current.needsUpdate = true;
    }
  }, [timeOffsetHours]);

  // Refactored 60FPS Main Animation Loop with Fast Smooth Lerp Blending
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      const gestureVal = gestureDataRef.current;

      // Unlocked Center Coordinate Inspection
      if (globeGroupRef.current && cameraRef.current && !isPinLockedRef.current) {
        const isMobile = window.innerWidth < 768;
        const targetNDC = { x: 0, y: isMobile ? -0.08 : 0 };
        const sphereHit = raycastGlobeHit(targetNDC, cameraRef.current, globeGroupRef.current, null);
        if (sphereHit) {
          const coords = convertPointToLatLng(sphereHit.point, globeGroupRef.current);
          if (coords) {
            const metrics = calculateGlobeMetrics(coords.lat, coords.lng, seaLevelRiseMRef.current, timeOffsetHoursRef.current);
            onSelectMetricsRef.current(metrics);
          }
        }
      }

      // 1. Direct Globe Rotation (🖐 Open Palm) - Zero inertia/coasting, instant stop
      if (globeGroupRef.current) {
        if (gestureVal.isTracking && gestureVal.gesture === "open_palm") {
          applyDirectRotation(globeGroupRef.current, gestureVal.deltaX, gestureVal.deltaY);
        }

        // Rotate cloud atmosphere layer
        cloudsMeshRef.current?.rotateY(0.0008);

        // Idle slow rotation when tracking is inactive and pin is locked
        if (!gestureVal.isTracking && isPinLockedRef.current) {
          globeGroupRef.current.rotation.y += 0.0008;
        }
      }

      // 2. Direct Steady Camera Zoom (👍 Thumbs Up = Zoom In, 👎 Thumbs Down = Zoom Out)
      if (cameraRef.current && gestureVal.isTracking) {
        if (gestureVal.gesture === "thumbs_up") {
          applySteadyZoom(cameraRef.current, "in", 0.12);
        } else if (gestureVal.gesture === "thumbs_down") {
          applySteadyZoom(cameraRef.current, "out", 0.12);
        }
      }

      // Discrete Action Gestures
      if (gestureVal.isTracking) {
        const now = Date.now();
        // ☝️ Pointing: Toggle / Lock Pin (1.5s debounce)
        if (gestureVal.gesture === "pointing" && now - lastLockGestureTimeRef.current > 1500) {
          lastLockGestureTimeRef.current = now;
          onTogglePinLockRef.current();
        }

        // ✌️ Peace Sign: Cycle Layer (1.2s debounce)
        if (gestureVal.gesture === "peace_layer" && now - lastPeaceTimeRef.current > 1200) {
          lastPeaceTimeRef.current = now;
          onLayerChangeRequestRef.current();
        }
      }

      // Smooth Lerp Blending for Layer Materials
      if (tempMeshRef.current) {
        const mat = tempMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacitiesRef.current.temperature, 0.12);
      }

      if (pressureMeshRef.current) {
        const mat = pressureMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacitiesRef.current.pressure, 0.12);
      }

      if (windParticlesRef.current) {
        const mat = windParticlesRef.current.material as THREE.PointsMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacitiesRef.current.airflow, 0.12);
        const targetSize = targetOpacitiesRef.current.airflow > 0 ? 0.18 : 0.01;
        mat.size = THREE.MathUtils.lerp(mat.size, targetSize, 0.12);
      }

      if (seaLevelMeshRef.current) {
        const mat = seaLevelMeshRef.current.material as THREE.MeshBasicMaterial;
        const pulse = activeLayerRef.current === "sealevel" ? Math.sin(Date.now() * 0.006) * 0.14 : 0;
        const targetOp = targetOpacitiesRef.current.sealevel > 0 ? Math.min(1.0, targetOpacitiesRef.current.sealevel + pulse) : 0;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOp, 0.12);
      }

      if (cloudsMeshRef.current) {
        const mat = cloudsMeshRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacitiesRef.current.precipitation, 0.12);
      }

      if (uvMeshRef.current) {
        const mat = uvMeshRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacitiesRef.current.uv, 0.12);
      }

      // Wind Vector Particles Dynamic Streamline Motion
      if (activeLayerRef.current === "airflow" || (windParticlesRef.current?.material as THREE.PointsMaterial).opacity > 0.05) {
        processWindParticles(windParticlesRef.current, 4.5, 1.2);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="w-full h-full absolute inset-0 overflow-hidden bg-slate-950 pointer-events-auto">
      <div ref={mountRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing touch-none" />

      {/* Unlocked Pin Overlay on separate screen layer (Zero lag when rotating globe) */}
      {!isPinLocked && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center z-20"
          style={typeof window !== "undefined" && window.innerWidth < 768 ? { transform: "translateY(28px)" } : undefined}
        >
          <div className="relative flex flex-col items-center -mt-7">
            {/* 2D Red Pin icon floating over center screen coordinate */}
            <div className="relative flex flex-col items-center animate-bounce duration-1000">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-600 to-red-500 border-2 border-white shadow-[0_0_16px_#ef4444] flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-white shadow-inner" />
              </div>
              <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-rose-600 -mt-0.5" />
            </div>
            {/* Target Ring ground contact shadow */}
            <div className="w-8 h-3 rounded-full bg-rose-500/30 border border-rose-500/70 blur-[0.5px] mt-0.5 animate-ping" />
          </div>
        </div>
      )}

      {/* Layer & Pin Status Badge Overlay */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-800 px-3.5 py-2 rounded-full text-xs text-slate-200 shadow-xl pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-semibold uppercase tracking-wider text-cyan-400">{activeLayer} LAYER</span>
        </div>

        <span className="text-slate-600">|</span>

        <div className="flex items-center gap-1.5 font-medium">
          {isPinLocked ? (
            <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 font-bold text-[11px]">
              📍 PIN LOCKED AT ({selectedMetrics.lat}°, {selectedMetrics.lng}°)
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold text-[11px]">
              🎯 CENTER TARGETING (UNLOCKED)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
