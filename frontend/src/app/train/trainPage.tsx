"use client";

import { type InputHTMLAttributes, use, useEffect, useState } from "react";
import { postTrain, type TrainResponse } from "../services/trainService";
import { renderShapPlot } from "../d3_visualizations/shap_plot";

const directoryInputAttrs: InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
} = {
  webkitdirectory: "true",
  directory: "",
};

export default function Train() {
  const [selectedTrainingFiles, setSelectedTrainingFiles] =
    useState<FileList | null>(null);
  const [selectedTargetLabelsFile, setSelectedTargetLabelsFile] =
    useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [trainResponse, setTrainResponse] = useState<TrainResponse | null>(
    null,
  );

  useEffect(() => {
    if (selectedTrainingFiles && selectedTargetLabelsFile) {
      setLoading(true);
      postTrain(selectedTrainingFiles, selectedTargetLabelsFile)
        .then((response) => {
          localStorage.setItem("Model Name", response.model_name);
          localStorage.setItem("Test Metric", response.test_metric.toString());
          localStorage.setItem(
            "SHAP Aggregation",
            JSON.stringify(response.shap_agg),
          );
          setTrainResponse(response);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedTrainingFiles, selectedTargetLabelsFile]);

  useEffect(() => {
    if (trainResponse) {
      const shapPlotContainer = document.getElementById("shap-plot");
      if (shapPlotContainer) {
        shapPlotContainer.innerHTML = "";
        const shapPlot = renderShapPlot(trainResponse, {
          width: window.innerWidth * 0.4,
          height: window.innerHeight * 0.3,
        });
        shapPlotContainer.appendChild(shapPlot);
      }
    }
  }, [trainResponse]);

  return (
    <div className="py-8 flex flex-col items-center justify-center gap-4">
      <h1 className="text-5xl font-bold mb-4">Train New Model</h1>
      <p className="text-1xl mb-2 font-bold text-center sm:text-center">
        This section allows you to upload training data and train a xgboost model
        for a target task using the available Proxy Tasks features. Please insert a directory containing the training images, and a json file containing only an array with the labels.
      </p>
      <div className="flex flex-row items-center justify-center gap-4">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="dirInput">
            Select Training Data Directory
          </label>
          <input
            className="border border-gray-300 rounded p-2 mb-4"
            type="file"
            id="dirInput"
            {...directoryInputAttrs}
            multiple
            onChange={(e) => setSelectedTrainingFiles(e.target.files)}
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-700 mb-2" htmlFor="labelsInput">
            Select Target Labels File
          </label>
          <input
            className="border border-gray-300 rounded p-2 mb-4"
            type="file"
            id="labelsInput"
            onChange={(e) => {
              const file = e.target.files ? e.target.files[0] : null;
              setSelectedTargetLabelsFile(file);
            }}
          />
        </div>
      </div>

      {loading && <p>Training model...</p>}
      {!loading && trainResponse && (
        <div className="mt-4 p-4 border border-[var(--accent-2)] rounded">
          <h3 className="text-xl font-bold mb-2">Training Complete!</h3>
          <h2 className="mb-2 text-lg font-bold">
            The model name has been saved to browser storage and will be used automatically on future analyses.
          </h2>
          <p>
            <strong>Model Name :</strong> {trainResponse.model_name}
          </p>
          <p>
            <strong>Test Metric:</strong> {trainResponse.test_metric}
          </p>
          <div id="shap-plot" className="mt-4" />
        </div>
      )}
    </div>
  );
}
