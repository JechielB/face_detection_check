// src/components/SignUp/Camera/FaceCircleCapture5.tsx
import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { COLORS } from "../../../constants/theme";
import { isIOS } from "../../../utils/cameraStream"; // keep your existing iOS detection

const DIRECTIONS = ["straight", "right", "left", "up", "down"] as const;
type Direction = (typeof DIRECTIONS)[number];
type FaceBasics = { yawNorm: number; pitchNorm: number };

const HOLD_MS_DIR = 420;
const HOLD_MS_STRAIGHT = 150;
const STRAIGHT_GIVEUP_MS = 1000;
const GATE_HOLD_MS = 2000;
const DISPLAY_ORDER: Direction[] = ["right", "left", "up", "down"];

type Props = { onComplete: (images: string[]) => void; onCancel: () => void };

export default function FaceCircleCapture5({ onComplete, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  const [faceLandmarker, setFaceLandmarker] = useState<FaceLandmarker | null>(
    null
  );
  const [videoReady, setVideoReady] = useState(false);

  const [phase, setPhase] = useState<"gate" | "detect">("gate");
  const [baseline, setBaseline] = useState<{
    yawNorm: number;
    pitchNorm: number;
  } | null>(null);

  const [captures, setCaptures] = useState<Partial<Record<Direction, string>>>(
    {}
  );
  const capturesRef = useRef<Partial<Record<Direction, string>>>({});

  const [currentDir, setCurrentDir] = useState<Direction | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState("");

  const liveInfoRef = useRef<{ basics: FaceBasics | null }>({ basics: null });
  const holdStartRef = useRef<Partial<Record<Direction, number | null>>>({});
  const straightHoldRef = useRef<number | null>(null);
  const straightStartRef = useRef<number | null>(null);
  const bestStraightRef = useRef<FaceBasics | null>(null);
  const isCapturingRef = useRef(false);
  const gateHoldRef = useRef<number | null>(null);

  // detectForVideo needs a monotonic timestamp
  const lastTsRef = useRef(0);

  function handleStraightPhase(basics: FaceBasics, now: number) {
    if (
      straightStartRef.current &&
      now - straightStartRef.current > STRAIGHT_GIVEUP_MS &&
      bestStraightRef.current
    ) {
      doCapture("straight");
      setBaseline(bestStraightRef.current);
      straightHoldRef.current = null;
      return;
    }

    if (!isStraightEnough(basics)) {
      straightHoldRef.current = null;
      return;
    }

    if (!straightHoldRef.current) straightHoldRef.current = now;
    else if (now - straightHoldRef.current >= HOLD_MS_STRAIGHT) {
      doCapture("straight");
      setBaseline(basics);
      straightHoldRef.current = null;
    }
  }

  function isStraightEnough(b: FaceBasics): boolean {
    const YAW = 0.02;
    const PITCH_MIN = -0.015;
    const PITCH_MAX = 0.055;
    return (
      Math.abs(b.yawNorm) < YAW &&
      b.pitchNorm > PITCH_MIN &&
      b.pitchNorm < PITCH_MAX
    );
  }

  function straightScore(b: FaceBasics): number {
    const yawScore = 1 - Math.min(Math.abs(b.yawNorm) / 0.04, 1);
    const pitchScore = 1 - Math.min(Math.abs(b.pitchNorm) / 0.08, 1);
    return (yawScore + pitchScore) / 2;
  }

  // ----------------- DIRECTION LOGIC -----------------
  function runDirectionStep(
    basics: FaceBasics,
    baseline0: FaceBasics,
    now: number
  ) {
    const relYaw = basics.yawNorm - baseline0.yawNorm;
    const relPitch = basics.pitchNorm - baseline0.pitchNorm;

    const YAW_NEED = 0.012;
    const PITCH_UP = 0.015;
    const PITCH_DOWN = 0.007;
    const H_TOL = 0.03;

    let dir: Direction | null = null;

    if (relYaw > YAW_NEED && Math.abs(relPitch) < H_TOL) dir = "right";
    else if (relYaw < -YAW_NEED && Math.abs(relPitch) < H_TOL) dir = "left";
    else if (relPitch < -PITCH_UP) dir = "up";
    else if (relPitch > PITCH_DOWN) dir = "down";

    setCurrentDir(dir);

    if (!dir) return;
    if (capturesRef.current[dir]) return;

    const prev = holdStartRef.current[dir] ?? null;

    if (!prev) holdStartRef.current[dir] = now;
    else if (now - prev >= HOLD_MS_DIR) {
      doCapture(dir);
      holdStartRef.current[dir] = null;
    }
  }

  // ----------------- CAPTURE LOGIC -----------------
  // ----------------- CAPTURE LOGIC -----------------
  function doCapture(dir: Direction) {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const w = videoEl.videoWidth;
    const h = videoEl.videoHeight;
    if (!w || !h) return;

    // 🔍 Log the actual resolution used for capture
    console.log(
      `[FaceCircleCapture5] Capturing "${dir}" at resolution: ${w}x${h}`
    );

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, w, h);
    const img = c.toDataURL("image/jpeg", 0.9);

    isCapturingRef.current = true;

    setCaptures((prev) => {
      const next = { ...prev, [dir]: img };
      capturesRef.current = next;

      const done = DIRECTIONS.map((d) => next[d]).filter(Boolean);
      if (done.length === DIRECTIONS.length) {
        setShowDone(true);
        setTimeout(() => onComplete(done as string[]), 2000);
      }

      return next;
    });

    setTimeout(() => {
      isCapturingRef.current = false;
    }, 200);
  }

  // ----------------- PIN DRAW -----------------
  function drawPins4(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    caps: Partial<Record<Direction, string>>,
    current: Direction | null
  ) {
    const cx = w / 2;
    const cy = h / 2;
    const thickness = 14;
    const r = Math.min(w, h) / 2 - thickness / 2 - 2;

    const quarters = [
      { dir: "up", start: -Math.PI * 0.78, end: -Math.PI * 0.22 },
      { dir: "right", start: -Math.PI * 0.22, end: Math.PI * 0.22 },
      { dir: "down", start: Math.PI * 0.22, end: Math.PI * 0.78 },
      { dir: "left", start: Math.PI * 0.78, end: Math.PI * 1.22 },
    ] as const;

    quarters.forEach((q) => {
      const done = !!caps[q.dir];
      const active = current === q.dir;

      ctx.beginPath();
      ctx.arc(cx, cy, r, q.start, q.end, false);
      ctx.strokeStyle = done
        ? COLORS.orange
        : active
        ? COLORS.orange
        : "rgba(255,255,255,0.3)";
      ctx.lineWidth = done || active ? thickness : thickness - 4;
      ctx.lineCap = "round";
      ctx.stroke();
    });
  }

  // ----------------- NEXT INSTRUCTION -----------------
  const nextInstruction: Direction | "straight" | "center" | null = (() => {
    if (showDone) return null;
    if (phase === "gate") return "center";
    if (!baseline) return "straight";

    // ✅ use the `captures` state value here to satisfy TS
    for (const d of DISPLAY_ORDER) {
      if (!captures[d]) return d;
    }
    return null;
  })();

  // ----------------------- CAMERA (with robust getUserMedia guard) -----------------------
  useEffect(() => {
    let mounted = true;

    const safePlay = async () => {
      const videoEl = videoRef.current;
      if (!videoEl) return;
      try {
        await videoEl.play();
      } catch (e) {
        console.warn("video.play() failed:", e);
      }
    };

    const onLoadedData = () => {
      const videoEl = videoRef.current;
      if (videoEl) {
        console.log(
          "[FaceCircleCapture5] onloadeddata – stream size:",
          videoEl.videoWidth,
          "x",
          videoEl.videoHeight
        );
      }
      // Safari sometimes ignores play() unless you retry on loadeddata
      safePlay();
      setVideoReady(true);
    };

    (async () => {
      try {
        // ✅ Guard: only run when navigator exists (no SSR)
        if (typeof navigator === "undefined") {
          console.warn(
            "[FaceCircleCapture5] navigator is undefined (SSR or non-browser env)"
          );
          setError("Camera not available in this environment.");
          return;
        }

        // ✅ Guard: check mediaDevices + getUserMedia
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const navAny = navigator as any;
        const mediaDevices: MediaDevices | undefined =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (navigator as any).mediaDevices || navAny.mediaDevices;

        if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
          console.warn(
            "[FaceCircleCapture5] navigator.mediaDevices.getUserMedia is not available",
            navigator
          );
          setError("This browser does not support camera access.");
          return;
        }

        // ✅ Request front camera explicitly, with high 'ideal' resolution
        const stream = await mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 3840 }, // ask for up to 4K
            height: { ideal: 2160 },
          },
          audio: false,
        });

        // ⬇️ Try to push the track to its max capabilities
        const [videoTrack] = stream.getVideoTracks();
        if (videoTrack && typeof videoTrack.getCapabilities === "function") {
          const caps = videoTrack.getCapabilities();
          const constraints: MediaTrackConstraints = {};

          if (caps.width && typeof caps.width.max === "number") {
            constraints.width = caps.width.max;
          }
          if (caps.height && typeof caps.height.max === "number") {
            constraints.height = caps.height.max;
          }

          if (caps.facingMode && caps.facingMode.length) {
            constraints.facingMode = { ideal: "user" };
          }

          try {
            await videoTrack.applyConstraints(constraints);
            console.log(
              "[FaceCircleCapture5] applied max constraints:",
              constraints
            );
          } catch (err) {
            console.warn(
              "[FaceCircleCapture5] applyConstraints failed, using negotiated resolution:",
              err
            );
          }
        }

        if (!mounted) {
          // If we unmounted while permission prompt was open
          if (isIOS()) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        const videoEl = videoRef.current;
        if (!videoEl) return;

        videoEl.srcObject = stream;

        // iOS Safari playsInline must be set as attributes (not only React prop)
        videoEl.setAttribute("playsinline", "true");
        videoEl.setAttribute("webkit-playsinline", "true");
        videoEl.muted = true; // helps autoplay on mobile

        // metadata -> play attempt #1 + log actual resolution
        videoEl.onloadedmetadata = () => {
          console.log(
            "[FaceCircleCapture5] onloadedmetadata – stream size:",
            videoEl.videoWidth,
            "x",
            videoEl.videoHeight
          );
          safePlay();
          setVideoReady(true);
        };

        // play attempt #2 (Safari reliability)
        videoEl.addEventListener("loadeddata", onLoadedData);

        // In case metadata never fires on some devices
        safePlay();
      } catch (e: unknown) {
        console.error("[FaceCircleCapture5] getUserMedia error:", e);
        const name = (e as { name?: string }).name || "Error";
        setError(`Camera access failed: ${name}`);
      }
    })();

    return () => {
      mounted = false;

      const videoEl = videoRef.current;
      videoEl?.removeEventListener("loadeddata", onLoadedData);
      if (videoEl) videoEl.onloadedmetadata = null;

      // Stop tracks ONLY on iOS; do NOT stop on Android (prevents “won’t reopen” issues)
      if (isIOS()) {
        const tracks = streamRef.current?.getTracks() ?? [];
        tracks.forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Detach element either way (safe UI cleanup)
      if (videoEl) videoEl.srcObject = null;
      setVideoReady(false);
    };
  }, []);

  // ------------------ MEDIAPIPE INIT (with SIMD + noSIMD fallback) ------------------
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let vision: any;

        try {
          // SIMD first
          vision = await FilesetResolver.forVisionTasks("/mediapipe");
        } catch (e) {
          console.warn(
            "MediaPipe SIMD init failed, falling back to no-SIMD:",
            e
          );
          // In this example we just retry the same path; in a real app you might load a different bundle
          vision = await FilesetResolver.forVisionTasks("/mediapipe");
        }

        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/mediapipe/face_landmarker.task",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (!alive) {
          lm.close?.();
          return;
        }

        setFaceLandmarker(lm);
      } catch (e) {
        console.error(e);
        setError("Model load failed");
      }
    })();

    return () => {
      alive = false;
      // best-effort cleanup
      setFaceLandmarker((prev) => {
        prev?.close?.();
        return null;
      });
    };
  }, []);

  // ------------------ DETECTION LOOP (detectForVideo) ------------------
  useEffect(() => {
    function detect() {
      try {
        if (!faceLandmarker || !videoRef.current) return;

        const videoEl = videoRef.current;

        // Need current frame data
        if (!videoEl || videoEl.readyState < 2) return;

        const w = videoEl.videoWidth;
        const h = videoEl.videoHeight;
        if (!w || !h) return;

        // monotonic timestamp
        const now = performance.now();
        const ts = now <= lastTsRef.current ? lastTsRef.current + 1 : now;
        lastTsRef.current = ts;

        // FAST + correct for VIDEO mode
        const res = faceLandmarker.detectForVideo(videoEl, ts);

        if (res.faceLandmarks?.[0]) {
          const lm = res.faceLandmarks[0];

          const noseX = lm[1].x;
          const leftEyeOuterX = lm[33].x;
          const rightEyeOuterX = lm[263].x;
          const eyeCenterX = (leftEyeOuterX + rightEyeOuterX) / 2;

          const mouthY = lm[13].y;
          const leftEyeOuterY = lm[33].y;
          const rightEyeOuterY = lm[263].y;
          const eyeCenterY = (leftEyeOuterY + rightEyeOuterY) / 2;

          const yawNorm = noseX - eyeCenterX;
          const pitchNorm = mouthY - eyeCenterY;

          const basics = { yawNorm, pitchNorm };
          liveInfoRef.current.basics = basics;

          // Gate → Detect
          if (phase === "gate") {
            const now2 = performance.now();
            if (!gateHoldRef.current) gateHoldRef.current = now2;
            else if (now2 - gateHoldRef.current >= GATE_HOLD_MS) {
              setPhase("detect");
              gateHoldRef.current = null;
              straightStartRef.current = null;
              bestStraightRef.current = null;
            }
          }

          if (phase === "detect" && !baseline) {
            if (!straightStartRef.current)
              straightStartRef.current = performance.now();

            if (
              !bestStraightRef.current ||
              straightScore(basics) > straightScore(bestStraightRef.current)
            ) {
              bestStraightRef.current = basics;
            }
          }
        } else {
          liveInfoRef.current.basics = null;
          if (phase === "gate") gateHoldRef.current = null;
        }
      } catch (e) {
        console.warn("detectForVideo failed:", e);
      }
    }

    const interval = window.setInterval(detect, 110);
    return () => clearInterval(interval);
  }, [faceLandmarker, baseline, phase]);

  // ------------------- DRAWING LOOP -------------------
  useEffect(() => {
    let frameId: number;

    const draw = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);

      const basics = liveInfoRef.current.basics;

      if (
        phase === "detect" &&
        videoReady &&
        basics &&
        !isCapturingRef.current &&
        !showDone
      ) {
        const now = performance.now();
        if (!baseline) handleStraightPhase(basics, now);
        else runDirectionStep(basics, baseline, now);
      }

      if (phase === "detect" && baseline) {
        drawPins4(ctx, w, h, capturesRef.current, currentDir);
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [baseline, videoReady, currentDir, showDone, phase]);

  // ----------------- UI -----------------
  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center gap-6 relative">
      {!showDone && nextInstruction && (
        <div className="text-white text-3xl md:text-4xl font-bold text-center mb-2">
          {nextInstruction === "center" &&
            "Position your face within the frame."}
          {nextInstruction === "straight" && "LOOK FORWARD"}
          {nextInstruction === "right" && "LOOK LEFT"}
          {nextInstruction === "left" && "LOOK RIGHT"}
          {nextInstruction === "up" && "LOOK UP"}
          {nextInstruction === "down" && "LOOK DOWN"}
        </div>
      )}

      <div className="relative w-[80vw] h-[80vw] max-w-[360px] max-h-[360px]">
        <div
          ref={containerRef}
          className="absolute inset-0 rounded-full overflow-hidden bg-black"
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover transform -scale-x-100"
            autoPlay
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none transform -scale-x-100"
          />
        </div>

        {phase === "gate" && !showDone && (
          <div className="pointer-events-none absolute inset-14 z-20">
            <div className="absolute top-0 left-0 w-9 h-9 border-t-[4px] border-l-[4px] border-white rounded-tl-2xl" />
            <div className="absolute top-0 right-0 w-9 h-9 border-t-[4px] border-r-[4px] border-white rounded-tr-2xl" />
            <div className="absolute bottom-0 left-0 w-9 h-9 border-b-[4px] border-l-[4px] border-white rounded-bl-2xl" />
            <div className="absolute bottom-0 right-0 w-9 h-9 border-b-[4px] border-r-[4px] border-white rounded-br-2xl" />
          </div>
        )}
      </div>

      {!showDone && (
        <button
          onClick={onCancel}
          className="text-xs px-5 py-2 rounded-full bg-black border border-white/20 text-white/80 hover:bg:white/5 transition"
        >
          Cancel
        </button>
      )}

      {showDone && (
        <div className="absolute inset-0 flex items-center justify-center z-40">
          <div
            className="px-8 py-6 rounded-2xl text-center backdrop-blur-md shadow-xl"
            style={{
              background: "rgba(0,0,0,0.55)",
              border: `2px solid ${COLORS.orange}`,
              boxShadow: `0 0 40px ${COLORS.orange}55`,
            }}
          >
            <h2 className="text-white text-2xl md:text-3xl font-bold mb-2">
              Capture Complete
            </h2>
            <p className="text-white/80 text-sm md:text-base mb-5 max-w-[260px]">
              All angles successfully captured. You're ready to continue.
            </p>

            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-full text-white"
              style={{ background: COLORS.orange }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="absolute bottom-4 text-red-400 text-xs bg-red-500/5 border border-red-500/30 px-3 py-2 rounded-lg max-w-xs text-center">
          {error}
        </p>
      )}
    </div>
  );
}
