import { useEffect, useState } from "react";
import {
  type FeatureData,
  renderFeatureData,
} from "../d3_visualizations/feature_data";
import GenerateSelectionVisualization from "./selectionVisualizations";


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
  const [selectedPointIndices, setSelectedPointIndices] = useState<number[]>(
    [],
  );
  const [shouldHaveSecondSelection, setShouldHaveSecondSelection] = useState(false);

  useEffect(() => {
    if (proxyTaskName) {
      try {
        const svgElement = renderFeatureData(
          featureData,
          proxyTaskName,
          selected_files,
          colorByProxyTaskName,
          {
            width: window.innerWidth * 0.4,
            height: window.innerHeight * 0.4,
          }
        );
        const handlePointsBrushed = (event: Event) => {
          const { detail } = event as CustomEvent<number[]>;
          setSelectedPointIndices(detail);
        };
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
    <div className="flex flex-col items-center justify-center gap-4">
      <h1 className="text-5xl font-bold text-center sm:text-left py-8">
        Feature Visualization
      </h1>
    <div className="py-2 flex flex-row items-center justify-start gap-4">
      <div>
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

      </div>
      {selectedPointIndices.length > 0 && (
        <GenerateSelectionVisualization
          id_number={1}
          selectedPointIndices={selectedPointIndices}
          featureData={featureData}
          shouldPlotScatter={true}
          renderOptions={{width: window.innerWidth * 0.25, height: window.innerHeight * 0.25}}
        />
      )}
      <div>
        {selectedPointIndices.length > 0 && !shouldHaveSecondSelection && (
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 my-2 px-4 rounded"
            onClick={() => setShouldHaveSecondSelection(true)}
          >
            Add Second Selection Visualization
          </button>
        )}
        {selectedPointIndices.length > 0 && shouldHaveSecondSelection && (
          <GenerateSelectionVisualization
            id_number={2}
            selectedPointIndices={selectedPointIndices}
            featureData={featureData}
            shouldPlotScatter={true}
            renderOptions={{width: window.innerWidth * 0.25, height: window.innerHeight * 0.25}}
          />
        )}

      </div>
    </div>
    <div>
      <h2 className="text-xl font-bold mb-2">General Dataset Visualization</h2>
      <GenerateSelectionVisualization
        id_number={3}
        featureData={featureData}
        selectedPointIndices={Array.from({ length: featureData.features[Object.keys(featureData.features)[0]].length }, (_, i) => i)}
        shouldPlotScatter={false}
        renderOptions={{width: window.innerWidth * 0.4, height: window.innerHeight * 0.4}}
      />
    </div>
    </div>
  );
}
