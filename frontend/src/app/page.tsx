"use client";
import { useState } from "react";
import AnalyzeFeatures from "./features/featuresPage";
import Train from "./train/trainPage";

export default function Home() {
  const [view, setView] = useState<"analyze" | "train">("analyze");
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-start py-16 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-5xl font-bold text-center sm:text-left py-8">
          Welcome to EISP Viewer!
        </h1>

        <select
          className="border border-gray-300 rounded p-2 mb-4"
          onChange={(e) => {
            const value = e.target.value;
            setView(value as "analyze" | "train");
          }}
        >
          <option value="analyze">Analyze</option>
          <option value="train">Train</option>
        </select>

        {view === "analyze" && <AnalyzeFeatures />}
        {view === "train" && <Train />}
      </main>
    </div>
  );
}
