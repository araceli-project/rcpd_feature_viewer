"use client";

import { type InputHTMLAttributes, useEffect, useState } from "react";
import type { FeatureData } from "../d3_visualizations/feature_data";
import {
  type FeaturesResponse,
  getClassificationData,
  getMultipleResultsData,
  postFeatures,
} from "../services/featuresService";

import GenerateFeatureVisualization from "./featureVisualizations";

const directoryInputAttrs: InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
} = {
  webkitdirectory: "true",
  directory: "",
};

export default function AnalyzeFeatures() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [featureData, setFeatureData] = useState<FeatureData | null>(null);
  const [loading, setLoading] = useState(false);
  const [csaiModelName, setCsaiModelName] = useState<string | null>(null);
  const [shouldRequestFeatures, setShouldRequestFeatures] = useState(true);

  useEffect(() => {
    if (selectedFiles && shouldRequestFeatures) {
      setLoading(true);
      const model_name =
        csaiModelName || localStorage.getItem("Model Name") || "";
      postFeatures(selectedFiles, model_name)
        .then((response: FeaturesResponse) => {
          const proxy_tasks_names = Object.keys(response.features);
          const classification_results: Record<string, string[]> =
            getClassificationData(response);
          const multiple_results: Record<string, string[][]> =
            getMultipleResultsData(response);
          setFeatureData({
            features: response.features,
            proxy_tasks_names,
            classification_results,
            multiple_results,
          });
          console.log("Multiple Results Data:", multiple_results);
          localStorage.setItem(
            "Features Data",
            JSON.stringify({
              features: response.features,
              proxy_tasks_names,
              classification_results,
              multiple_results,
            }),
          );
        })
        .catch((error) => {
          console.error("Error fetching features:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedFiles, shouldRequestFeatures, csaiModelName]);

  return (
    <div className="w-full flex flex-col items-center">
      <h1 className="text-5xl font-bold text-center sm:text-left py-8">
        Feature Analysis
      </h1>
      <h2 className="text-xl font-bold mb-2 text-center sm:text-center">
        Please select a directory containing the images to be analyzed, and if desired specify a csai model name.
      </h2>
      <div className="flex flex-row items-center justify-center gap-4">
      {!loading && (
        <input
          className="border border-gray-300 rounded p-2 mb-4 py-4"
          type="file"
          id="dirInput"
          {...directoryInputAttrs}
          multiple
          onChange={(e) => {
            setShouldRequestFeatures(false);
            setSelectedFiles(e.target.files);
          }}
        />
      )}

      {!loading && (
        <input
          className="border border-gray-300 rounded p-2 mb-4 py-4"
          type="text"
          id="modelNameInput"
          placeholder="Overwrite CSAI Model Name"
          onChange={(e) => {
            setShouldRequestFeatures(false);
            setCsaiModelName(e.target.value);
          }}
        />
      )}

      </div>

      <div className="flex flex-row items-center justify-center gap-4">
      {!loading && (
        <button
          className="bg-[var(--accent-2)] hover:bg-[var(--accent-1)] text-white font-bold py-2 my-2 px-4 rounded"
          type="button"
          onClick={() => {
            setShouldRequestFeatures(true);
          }}
        >
          Analyze Features
        </button>
      )}

      {!loading && (
        <button
          className="bg-[var(--accent-2)] hover:bg-[var(--accent-1)] text-white font-bold py-2 my-2 px-4 rounded"
          type="button"
          onClick={() => {
            setShouldRequestFeatures(false);
            setFeatureData(
              localStorage.getItem("Features Data")
                ? JSON.parse(localStorage.getItem("Features Data") as string)
                : null,
            );
          }}
        >
          Restore Last Features Data.
        </button>
      )}

      </div>



      {loading && <p>Loading...</p>}

      {!loading && featureData && selectedFiles && (
        <GenerateFeatureVisualization
          featureData={featureData}
          selected_files={selectedFiles}
        />
      )}
    </div>
  );
}
