import { GestureType, HandGestureData } from "../types";

// Skeleton connections for MediaPipe hand landmarks (21 points)
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // Index
  [5, 9], [9, 10], [10, 11], [11, 12], // Middle
  [9, 13], [13, 14], [14, 15], [15, 16], // Ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky
];

interface Point3D {
  x: number;
  y: number;
  z?: number;
}

let prevCentroid = { x: 0.5, y: 0.5 };

export function classifyHandGesture(landmarks: Point3D[]): HandGestureData {
  if (!landmarks || landmarks.length < 21) {
    return {
      gesture: "none",
      confidence: 0,
      x: 0.5,
      y: 0.5,
      deltaX: 0,
      deltaY: 0,
      isTracking: false,
      landmarksCount: 0,
    };
  }

  // Key landmarks
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexMcp = landmarks[5]; // Index Knuckle
  const indexPip = landmarks[6];
  const indexTip = landmarks[8];
  const middlePip = landmarks[10];
  const middleTip = landmarks[12];
  const ringPip = landmarks[14];
  const ringTip = landmarks[16];
  const pinkyMcp = landmarks[17];
  const pinkyPip = landmarks[18];
  const pinkyTip = landmarks[20];

  // Finger extended states (Y-axis: 0 at top of video frame, 1 at bottom)
  const isIndexExtended = indexTip.y < indexPip.y;
  const isMiddleExtended = middleTip.y < middlePip.y;
  const isRingExtended = ringTip.y < ringPip.y;
  const isPinkyExtended = pinkyTip.y < pinkyPip.y;

  // Finger state combinations
  const allFourExtended = isIndexExtended && isMiddleExtended && isRingExtended && isPinkyExtended;
  const allFourFolded = !isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended;

  // Calculate hand centroid for direct position tracking
  const centroidX = (wrist.x + indexMcp.x + pinkyMcp.x) / 3;
  const centroidY = (wrist.y + indexMcp.y + pinkyMcp.y) / 3;

  let deltaX = 0;
  let deltaY = 0;

  let gesture: GestureType = "none";
  let confidence = 0.95;

  // FAST INSTANT CLASSIFICATION RULES
  // 1. OPEN PALM (Direct Globe Rotation): All 4 fingers extended
  if (allFourExtended) {
    gesture = "open_palm";
    deltaX = centroidX - prevCentroid.x;
    deltaY = centroidY - prevCentroid.y;
  }
  // 2. PEACE SIGN: Index & Middle extended only
  else if (isIndexExtended && isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    gesture = "peace_layer";
  }
  // 3. POINTING: Index finger extended only
  else if (isIndexExtended && !isMiddleExtended && !isRingExtended && !isPinkyExtended) {
    gesture = "pointing";
  }
  // 4. CLOSED STATE: All 4 main fingers folded down below knuckles/PIPs
  else if (allFourFolded) {
    // Check Thumb Tip relative to Index Knuckle (INDEX_FINGER_MCP - landmark 5)
    // Remember: Y coordinate 0 is at top of video frame, 1 at bottom. So smaller Y = higher in real world.
    if (thumbTip.y < indexMcp.y - 0.03) {
      // THUMBS UP (👍): Thumb Tip is noticeably HIGHER than Index Knuckle
      gesture = "thumbs_up";
    } else if (thumbTip.y > indexMcp.y + 0.03) {
      // THUMBS DOWN (👎): Thumb Tip is noticeably LOWER than Index Knuckle
      gesture = "thumbs_down";
    } else {
      // CLOSED FIST (✊): Thumb Tip is level with or tucked across Index Knuckle (Neutral/Pause)
      gesture = "closed_fist";
    }
  }

  // Update centroid anchor
  prevCentroid = { x: centroidX, y: centroidY };

  // Return instant result without multi-frame buffer or delay
  return {
    gesture,
    confidence,
    x: indexTip.x,
    y: indexTip.y,
    deltaX,
    deltaY,
    isTracking: true,
    landmarksCount: landmarks.length,
  };
}

/**
 * Draw skeleton bone structure on canvas overlay
 */
export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Point3D[],
  gesture: GestureType
) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  // Clear previous frame
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || landmarks.length < 21) return;

  // Pick glowing color depending on gesture mode
  let color = "#38bdf8"; // cyan default
  if (gesture === "open_palm") color = "#34d399"; // emerald
  if (gesture === "closed_fist") color = "#94a3b8"; // slate / gray
  if (gesture === "thumbs_up") color = "#38bdf8"; // cyan / blue
  if (gesture === "thumbs_down") color = "#f43f5e"; // rose / red
  if (gesture === "pointing") color = "#fbbf24"; // amber
  if (gesture === "peace_layer") color = "#a855f7"; // purple

  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  for (const [start, end] of HAND_CONNECTIONS) {
    const p1 = landmarks[start];
    const p2 = landmarks[end];
    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }
  }

  // Draw joint nodes
  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    ctx.beginPath();
    const radius = i === 8 ? 7 : (i === 4 || i === 12 || i === 16 || i === 20 ? 5 : 3);
    ctx.arc(p.x * width, p.y * height, radius, 0, 2 * Math.PI);
    ctx.fillStyle = i === 8 && gesture === "pointing" ? "#ffffff" : color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Reset shadow
  ctx.shadowBlur = 0;
}
