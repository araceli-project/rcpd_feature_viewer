"use client";

import { type InputHTMLAttributes, useEffect, useState } from "react";
import {
  type FeaturesResponse,
  getClassificationData,
  getMultipleResultsData,
  postFeatures,
} from "../services/featuresService";
import {
  type FeatureData,
  renderFeatureData,
} from "../d3_visualizations/feature_data";

import GenerateFeatureVisualization from "./featureVisualizations"

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
      const model_name = csaiModelName || localStorage.getItem("Model Name") || "";
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
          localStorage.setItem("Features Data", JSON.stringify({
            features: response.features,
            proxy_tasks_names,
            classification_results,
            multiple_results,
          }));
          localStorage.setItem("File Names", JSON.stringify(Array.from(selectedFiles).map(file => file.name)));
        })
        .catch((error) => {
          console.error("Error fetching features:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedFiles]);

  return (
    <div className="w-full flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-4">
        Upload Images for Feature Analysis
      </h2>

      {!loading && <input
        className="border border-gray-300 rounded p-2 mb-4"
        type="text"
        id="modelNameInput"
        placeholder="Overwrite CSAI Model Name"
        onChange={(e) => setCsaiModelName(e.target.value)}
      />}
      {!loading && <input
        className="border border-gray-300 rounded p-2 mb-4"
        type="file"
        id="dirInput"
        {...directoryInputAttrs}
        multiple
        onChange={(e) => {
          setShouldRequestFeatures(true);
          setSelectedFiles(e.target.files);
        }}
      />}
      {!loading && <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 my-2 px-4 rounded"
        onClick={() => {
          setShouldRequestFeatures(false);
          setFeatureData(localStorage.getItem("Features Data") ? JSON.parse(localStorage.getItem("Features Data") as string) : null);
          setSelectedFiles(localStorage.getItem("File Names") ? JSON.parse(localStorage.getItem("File Names") as string) : null);
        }}
      >
        Restore Last Features Data.
      </button>}

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
