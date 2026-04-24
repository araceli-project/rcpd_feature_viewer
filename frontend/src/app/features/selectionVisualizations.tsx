import { useEffect, useState } from "react";
import {
  classificationBarChart,
  classificationPieChart,
} from "../d3_visualizations/classification_plots";
import {
  FeatureData,
  RenderFeatureDataOptions,
  renderSelectedFeatureData,
} from "../d3_visualizations/feature_data";
import {
  multipleDataBarChart,
  multipleDataPieChart,
} from "../d3_visualizations/multiple_data_plots";

export default function GenerateSelectionVisualization({
  selectedPointIndices,
  featureData,
  shouldPlotScatter,
  renderOptions,
  id_number,
}: {
  selectedPointIndices: number[];
  featureData: FeatureData;
  shouldPlotScatter: boolean;
  renderOptions?: RenderFeatureDataOptions;
  id_number: number;
}) {
  const possibleProxyTaskNames = Object.keys(
    featureData.classification_results,
  ).concat(Object.keys(featureData.multiple_results));
  const [selectedProxyTaskName, setSelectedProxyTaskName] = useState<string>(
    possibleProxyTaskNames[0] || "",
  );

  useEffect(() => {
    if (selectedProxyTaskName) {
      try {
        const container = document.getElementById(`selection-visualization-${id_number}`);
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

        const featureToPlot = selectedProxyTaskName === "age" || selectedProxyTaskName === "child" || selectedProxyTaskName === "gender" ? "Age_Gender" : selectedProxyTaskName;
        if (shouldPlotScatter && featureData.features[featureToPlot] && featureData.features[featureToPlot][0].length == 2) {
          const selectedRendered = renderSelectedFeatureData(
            featureData,
            featureToPlot,
            selectedPointIndices,
            renderOptions
          );
          if (container) {
            container.appendChild(selectedRendered);
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
      <div id={`selection-visualization-${id_number}`} className="py-4"></div>
    </div>
  );
}