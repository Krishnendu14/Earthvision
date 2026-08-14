import * as THREE from "three";

// Reusable scratch variables defined outside main render loops to minimize GC allocations & frame hitching
const scratchRaycaster = new THREE.Raycaster();
const scratchVec2 = new THREE.Vector2();
const scratchLocalPoint = new THREE.Vector3();

/**
 * Converts geographic latitude/longitude to a 3D Cartesian position on a sphere of specified radius.
 */
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

/**
 * Converts world 3D coordinates on globe mesh into spherical latitude/longitude.
 */
export function convertPointToLatLng(
  worldPoint: THREE.Vector3,
  globeGroup: THREE.Group
): { lat: number; lng: number } | null {
  scratchLocalPoint.copy(worldPoint);
  globeGroup.worldToLocal(scratchLocalPoint);
  scratchLocalPoint.normalize();

  const lat = 90 - (Math.acos(THREE.MathUtils.clamp(scratchLocalPoint.y, -1, 1)) * 180) / Math.PI;
  const lng = ((Math.atan2(scratchLocalPoint.z, -scratchLocalPoint.x) * 180) / Math.PI) - 180;

  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Intersects scene objects using Normalized Device Coordinates without creating new Raycaster instances.
 */
export function raycastGlobeHit(
  ndc: { x: number; y: number },
  camera: THREE.Camera,
  globeGroup: THREE.Group,
  excludeObject?: THREE.Object3D | null
): THREE.Intersection | undefined {
  scratchVec2.set(ndc.x, ndc.y);
  scratchRaycaster.setFromCamera(scratchVec2, camera);

  const intersects = scratchRaycaster.intersectObjects(globeGroup.children, true);
  return intersects.find(
    (hit) => hit.object.type === "Mesh" && hit.object !== excludeObject
  );
}

/**
 * Applies direct, 1-to-1 rotational mapping from hand movement to globe rotation.
 * Motion stops instantly when hand gesture is lost or closed (no inertia or coasting).
 */
export function applyDirectRotation(
  globeGroup: THREE.Group,
  deltaX: number,
  deltaY: number,
  sensitivity = 3.5
): void {
  globeGroup.rotation.y -= deltaX * sensitivity;
  globeGroup.rotation.x += deltaY * sensitivity;

  // Clamp vertical rotation to avoid pole flip disorientations
  globeGroup.rotation.x = THREE.MathUtils.clamp(
    globeGroup.rotation.x,
    -Math.PI / 2.2,
    Math.PI / 2.2
  );
}

/**
 * Applies constant, steady camera zoom motion for Thumbs Up / Thumbs Down.
 * Stops instantly when the gesture releases.
 */
export function applySteadyZoom(
  camera: THREE.PerspectiveCamera,
  direction: "in" | "out",
  speed = 0.12,
  minDist = 6.2,
  maxDist = 25.0
): void {
  const delta = direction === "in" ? -speed : speed;
  camera.position.z = THREE.MathUtils.clamp(camera.position.z + delta, minDist, maxDist);
}

/**
 * Updates wind vector particle coordinates frame-by-frame based on global wind circulation belts
 * (Jet streams in mid-latitudes, equatorial trade winds, polar easterlies).
 */
export function processWindParticles(
  windParticles: THREE.Points | null,
  globeRadius = 4.5,
  speedMultiplier = 1.0
): void {
  if (!windParticles) return;

  const positions = windParticles.geometry.attributes.position.array as Float32Array;
  const colors = windParticles.geometry.attributes.color.array as Float32Array;
  const count = positions.length / 3;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    let x = positions[idx];
    let y = positions[idx + 1];
    let z = positions[idx + 2];

    const currentRadius = Math.hypot(x, y, z);
    if (currentRadius === 0) continue;

    // Convert (x, y, z) to spherical latitude & longitude
    const normY = THREE.MathUtils.clamp(y / currentRadius, -1, 1);
    const lat = 90 - (Math.acos(normY) * 180) / Math.PI;
    let lng = (Math.atan2(z, -x) * 180) / Math.PI - 180;

    const absLat = Math.abs(lat);

    // Calculate realistic wind velocity vector
    let speedKmh = 20;
    let deltaLng = 0;
    let deltaLat = Math.sin(lng * 0.05) * 0.05;

    if (absLat >= 30 && absLat <= 62) {
      // Mid-Latitude Jet Stream Current (High Wind Speed ~ 47.4 km/h Eastward)
      speedKmh = 47.4 + Math.sin(lat * 0.2) * 12;
      deltaLng = 0.85 * speedMultiplier; // Eastward drift
      deltaLat += Math.cos(lng * 0.08) * 0.12;
    } else if (absLat < 22) {
      // Equatorial Trade Winds (Westward drift)
      speedKmh = 22.0 + Math.cos(lng * 0.1) * 6;
      deltaLng = -0.42 * speedMultiplier; // Westward drift
    } else {
      // Polar Easterlies (Westward katabatic flow)
      speedKmh = 32.0;
      deltaLng = -0.35 * speedMultiplier;
    }

    lng = (lng + deltaLng + 180) % 360 - 180;
    const newLat = THREE.MathUtils.clamp(lat + deltaLat, -82, 82);

    // Convert updated (newLat, lng) back to 3D Cartesian coordinates
    const r = globeRadius + 0.12 + Math.sin(i * 1.7) * 0.08;
    const phi = (90 - newLat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);

    positions[idx] = -(r * Math.sin(phi) * Math.cos(theta));
    positions[idx + 1] = r * Math.cos(phi);
    positions[idx + 2] = r * Math.sin(phi) * Math.sin(theta);

    // Dynamic Color Mapping based on Wind Speed:
    // High Speed (>40 km/h Jet Stream) -> Brilliant Cyan-White
    // Low Speed (<25 km/h) -> Deep Teal-Blue
    if (colors && colors.length > idx + 2) {
      const speedRatio = Math.min(1, Math.max(0, (speedKmh - 15) / 35));
      colors[idx] = THREE.MathUtils.lerp(0.1, 0.9, speedRatio);     // R
      colors[idx + 1] = THREE.MathUtils.lerp(0.6, 1.0, speedRatio); // G
      colors[idx + 2] = 1.0;                                        // B
    }
  }

  windParticles.geometry.attributes.position.needsUpdate = true;
  if (windParticles.geometry.attributes.color) {
    windParticles.geometry.attributes.color.needsUpdate = true;
  }
}
