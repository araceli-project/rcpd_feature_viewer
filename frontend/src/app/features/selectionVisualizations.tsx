import { useEffect, useState } from "react";
import {
  classificationBarChart,
  classificationPieChart,
} from "../d3_visualizations/classification_plots";
import type {
  FeatureData,
  RenderFeatureDataOptions,
} from "../d3_visualizations/feature_data";
import {
  multipleDataBarChart,
  multipleDataPieChart,
} from "../d3_visualizations/multiple_data_plots";

export default function GenerateSelectionVisualization({
  selectedPointIndices,
  featureData,
}: {
  selectedPointIndices: number[];
  featureData: FeatureData;
}) {
  const possibleProxyTaskNames = Object.keys(
    featureData.classification_results,
  ).concat(Object.keys(featureData.multiple_results));
  const [selectedProxyTaskName, setSelectedProxyTaskName] = useState<string>(
    possibleProxyTaskNames[0] || "",
  );
  const renderOptions: RenderFeatureDataOptions = {
    width: window.innerWidth * 0.4,
    height: window.innerHeight * 0.4,
  };

  useEffect(() => {
    if (selectedProxyTaskName) {
      try {
        const container = document.getElementById("selection-visualization");
        if (container) {
          container.innerHTML = "";
        }

        if (featureData.classification_results[selectedProxyTaskName]) {
          const barSvgElement = classificationBarChart(
            featureData,
            selectedProxyTaskName,
            selectedPointIndices,
            renderOptions,
          );
          const pieSvgElement = classificationPieChart(
            featureData,
            selectedProxyTaskName,
            selectedPointIndices,
            renderOptions,
          );
          if (container) {
            container.appendChild(barSvgElement);
            container.appendChild(pieSvgElement);
          }
        }

        if (featureData.multiple_results[selectedProxyTaskName]) {
          const multipleBarSvgElement = multipleDataBarChart(
            featureData,
            selectedProxyTaskName,
            selectedPointIndices,
            renderOptions,
          );
          const multiplePieSvgElement = multipleDataPieChart(
            featureData,
            selectedProxyTaskName,
            selectedPointIndices,
            renderOptions,
          );
          if (container) {
            container.appendChild(multipleBarSvgElement);
            container.appendChild(multiplePieSvgElement);
          }
        }
      } catch (error) {
        console.error("Error rendering selection visualization:", error);
      }
    }
  }, [selectedProxyTaskName, selectedPointIndices, featureData]);
  return (
    <div>
      <h1>Selection Visualization</h1>

      <select
        value={selectedProxyTaskName}
        onChange={(e) => setSelectedProxyTaskName(e.target.value)}
      >
        {possibleProxyTaskNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <div id="selection-visualization" className="py-4"></div>
    </div>
  );
}
