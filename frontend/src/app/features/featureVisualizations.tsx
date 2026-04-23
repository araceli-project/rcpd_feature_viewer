import { FeatureData } from "../d3_visualizations/feature_data";
import { renderFeatureData } from "../d3_visualizations/feature_data";
import { useEffect, useState } from "react";
import  GenerateSelectionVisualization from "./selectionVisualizations";

export default function GenerateFeatureVisualization({
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
  const [selectedPointIndices, setSelectedPointIndices] = useState<number[]>([]);

  useEffect(() => {
    if (proxyTaskName) {
      try {
        const svgElement = renderFeatureData(
          featureData,
          proxyTaskName,
          selected_files,
          colorByProxyTaskName,
        );
        const handlePointsBrushed = (event: Event) => {
          const { detail } = event as CustomEvent<number[]>;
          setSelectedPointIndices(detail);
        }
        svgElement.addEventListener("points-brushed", handlePointsBrushed);

        const container = document.getElementById("feature-visualization");
        if (container) {
          container.innerHTML = "";
          container.appendChild(svgElement);
        }
        return () => {
          svgElement.removeEventListener("points-brushed", handlePointsBrushed);
        };
      } catch (error) {
        console.error("Error rendering feature data:", error);
      }
    }
  }, [featureData, proxyTaskName, colorByProxyTaskName, selected_files]);

  return (
    <div className="py-2">
      <label htmlFor="proxyTaskSelect">Select Proxy Task: </label>
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

        {selectedPointIndices.length > 0 && (
            <GenerateSelectionVisualization
              selectedPointIndices={selectedPointIndices}
              featureData={featureData}
            />
          )}

    </div>
    
  );
}
