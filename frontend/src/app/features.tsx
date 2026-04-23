"use client";

import { type InputHTMLAttributes, useEffect, useState } from "react";
import {
  type FeaturesResponse,
  getClassificationData,
  getMultipleResultsData,
  postFeatures,
} from "./services/featuresService";
import {
  type FeatureData,
  renderFeatureData,
} from "./visualizations/feature_data";

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
  const [csaiModelName, setCsaiModelName] = useState<string | null>(null)

  useEffect(() => {
    if (selectedFiles) {
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

      <input
        className="border border-gray-300 rounded p-2 mb-4"
        type="text"
        id="modelNameInput"
        placeholder="Overwrite CSAI Model Name"
        onChange={(e) => setCsaiModelName(e.target.value)}
      />
      <input
        className="border border-gray-300 rounded p-2 mb-4"
        type="file"
        id="dirInput"
        {...directoryInputAttrs}
        multiple
        onChange={(e) => setSelectedFiles(e.target.files)}
      />
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

function GenerateFeatureVisualization({
  featureData,
  selected_files,
}: {
  featureData: FeatureData;
  selected_files: FileList;
}) {
  const [proxyTaskName, setProxyTaskName] = useState<string>(
    featureData.proxy_tasks_names[0] || "",
  );
  const [colorByProxyTaskName, setColorByProxyTaskName] = useState<string>(
    Object.keys(featureData.classification_results)?.[0] || "",
  );

  useEffect(() => {
    if (proxyTaskName) {
      try {
        const svgElement = renderFeatureData(
          featureData,
          proxyTaskName,
          selected_files,
          colorByProxyTaskName,
        );
        const container = document.getElementById("feature-visualization");
        if (container) {
          container.innerHTML = "";
          container.appendChild(svgElement);
        }
      } catch (error) {
        console.error("Error rendering feature data:", error);
      }
    }
  }, [featureData, proxyTaskName, colorByProxyTaskName, selected_files]);

  return (
    <div>
      <label htmlFor="proxyTaskSelect">Select Proxy Task:</label>
      <select
        id="proxyTaskSelect"
        value={proxyTaskName}
        onChange={(e) => setProxyTaskName(e.target.value)}
      >
        {featureData.proxy_tasks_names
          .filter((name) => featureData.features[name][0].length === 2)
          .map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
      </select>
      <select
        id="colorByProxyTaskSelect"
        value={colorByProxyTaskName}
        onChange={(e) => setColorByProxyTaskName(e.target.value)}
      >
        <option value="">No Color Grouping</option>
        {Object.keys(featureData.classification_results).map((name) => (
          <option key={name} value={name}>
            Color by {name}
          </option>
        ))}
      </select>
      <div id="feature-visualization" style={{ marginTop: "20px" }}></div>
    </div>
  );
}
