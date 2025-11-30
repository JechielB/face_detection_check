import React, { useState } from "react";
import CameraModal from "../modals/CameraModal";

export default function TestHarness() {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("Idle");

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="text-2xl font-bold mb-2">Test</div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setStatus("Opening modal…");
              setOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white text-black font-semibold hover:opacity-90"
          >
            Open Camera Modal
          </button>

          <button
            onClick={() => {
              setImages([]);
              setStatus("Cleared");
            }}
            className="px-4 py-2 rounded-xl bg-transparent border border-white/15 text-white/80 hover:bg-white/5"
          >
            Clear Captures
          </button>

          <div className="text-sm text-white/60">Status: {status}</div>
        </div>

        {images.length > 0 && (
          <div className="mt-5">
            <div className="font-semibold mb-2">Captured ({images.length})</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((src, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden border border-white/10 bg-black"
                >
                  <img src={src} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-white/50">
        Note: camera access on iPhone requires HTTPS when not using localhost.
      </div>

      <CameraModal
        open={open}
        onClose={() => {
          setStatus("Closed");
          setOpen(false);
        }}
        onDone={async (imgs) => {
          setStatus(`Got ${imgs.length} images`);
          setImages(imgs);
          setOpen(false);
        }}
      />
    </div>
  );
}
