"use client";
import { useState } from "react";
import AnalyzeFeatures from "./features/featuresPage";
import Train from "./train/trainPage";

export default function Home() {
  const [view, setView] = useState<"analyze" | "train">("analyze");
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <nav className="w-full flex items-center justify-between px-8 py-4 bg-white dark:bg-gray-900 shadow">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-[var(--accent-1)]">
            EISP Feature Viewer
          </h1>
        </div>
        <div>
        <button
          className="bg-[var(--accent-2)] hover:bg-[var(--accent-1)] text-white font-bold py-2 px-4 mx-2 rounded"
          onClick={() => {
            setView("analyze");
          }}
        >
          Analyze Features
        </button>
        <button
          className="bg-[var(--accent-2)] hover:bg-[var(--accent-1)] text-white font-bold py-2 px-4 mx-2 rounded"
          onClick={() => {
            setView("train");
          }}
        >
          Train Model
        </button>
        </div>
      </nav>
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-start px-16 bg-white dark:bg-black sm:items-start">
        {view === "analyze" && <AnalyzeFeatures />}
        {view === "train" && <Train />}
      </main>
    </div>
  );
}
