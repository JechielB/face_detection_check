import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import TestHarness from "./pages/TestHarness";
import Queue from "./pages/Queue";

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold tracking-tight">Face Capture Harness</div>
          <div className="flex gap-3 text-sm text-white/70">
            <Link to="/" className="hover:text-white">
              Home
            </Link>
            <Link to="/queue" className="hover:text-white">
              /queue
            </Link>
          </div>
        </div>

        <Routes>
          <Route path="/" element={<TestHarness />} />
          <Route path="/queue" element={<Queue />} />
        </Routes>
      </div>
    </div>
  );
}
