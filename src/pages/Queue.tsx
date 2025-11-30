import React from "react";

export default function Queue() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="text-2xl font-bold mb-2">Queue page</div>
      <p className="text-white/70">
        If your modal calls{" "}
        <code className="text-white">navigate("/queue")</code>, you should land
        here.
      </p>
    </div>
  );
}
