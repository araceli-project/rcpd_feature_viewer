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

  const [filterProxyTask, setFilterProxyTask] = useState<string>("");
  const [filterValue, setFilterValue] = useState<string>("");

  useEffect(() => {
    if (selectedProxyTaskName) {
      try {
        const container = document.getElementById(`selection-visualization-${id_number}`);
        if (container) {
          container.innerHTML = "";
        }

        var filteredSelectedIndices = selectedPointIndices;

        if (filterProxyTask && filterValue && filterValue !== "") {
          const classificationResult = featureData.classification_results[filterProxyTask];
          const multipleResult = featureData.multiple_results[filterProxyTask];
          filteredSelectedIndices = selectedPointIndices.filter((index) => {
            if (classificationResult && classificationResult[index]) {
              return classificationResult[index].includes(filterValue);
            }

            if (multipleResult && multipleResult[index]) {
              return multipleResult[index].includes(filterValue);
            }

            return false;
          });

          if (filteredSelectedIndices.length === 0) {
            if (container) {
              container.innerHTML = "<p>No data points match the selected filter.</p>";
            }
            return;
          }
        }

        if (featureData.classification_results[selectedProxyTaskName]) {
          const barSvgElement = classificationBarChart(
            featureData,
            selectedProxyTaskName,
            filteredSelectedIndices,
            renderOptions,
          );
          const pieSvgElement = classificationPieChart(
            featureData,
            selectedProxyTaskName,
            filteredSelectedIndices,
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
            filteredSelectedIndices,
            renderOptions,
          );
          const multiplePieSvgElement = multipleDataPieChart(
            featureData,
            selectedProxyTaskName,
            filteredSelectedIndices,
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
            filteredSelectedIndices,
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
  }, [selectedProxyTaskName, selectedPointIndices, featureData, filterProxyTask, filterValue]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-row gap-3 items-center border-2 border-[var(--accent-1)] p-2 rounded">
      <h1>Selection Visualization</h1>

      <select
        className="border-2 border-[var(--accent-3)] p-1 rounded"
        value={selectedProxyTaskName}
        onChange={(e) => setSelectedProxyTaskName(e.target.value)}
      >
        {possibleProxyTaskNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      </div>
      <div className="flex flex-row gap-3 items-center border-2 border-[var(--accent-2)] p-2 rounded">
        <h3>Filter:</h3>
      <select
        className="border-2 border-[var(--accent-3)] p-1 rounded"
        value={filterProxyTask}
        onChange={(e) => {
          setFilterProxyTask(e.target.value);
          setFilterValue("");
        }
      }
      >
        <option value="">No Filter</option>
        {Object.keys(featureData.classification_results).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        )).concat(Object.keys(featureData.multiple_results).map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        )))}
      </select>
      {filterProxyTask && (
        <div className="flex flex-row gap-3 items-center">
          <h3>Value:</h3>
        <select
          className="border-2 border-[var(--accent-3)] p-1 rounded"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        >
          <option value="">All Values</option>
          {((Array.from(new Set(featureData.classification_results[filterProxyTask]?.flat()))).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          )) || []).concat(Array.from(new Set(featureData.multiple_results[filterProxyTask]?.flat())).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          )) || [])}
        </select>
        </div>
      )}
      </div>
      <div id={`selection-visualization-${id_number}`} className="py-4"></div>
    </div>
  );
}