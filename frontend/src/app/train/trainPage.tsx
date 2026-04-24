"use client";

import { type InputHTMLAttributes, useEffect, useState } from "react";
import { postTrain, type TrainResponse } from "../services/trainService";

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

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Train New Model</h2>
      <p className="text-gray-600 mb-4">
        This section will allow you to upload training data and train a model
        for a target task.
      </p>

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
      {loading && <p>Training model...</p>}
      {!loading && trainResponse && (
        <div className="mt-4 p-4 border border-green-500 rounded bg-green-50">
          <h3 className="text-xl font-bold mb-2">Training Complete!</h3>
          <p>
            <strong>Model Name:</strong> {trainResponse.model_name}
          </p>
          <p>
            <strong>Test Metric:</strong> {trainResponse.test_metric}
          </p>
          <p>
            <strong>SHAP Aggregation:</strong>{" "}
            {JSON.stringify(trainResponse.shap_agg)}
          </p>
        </div>
      )}
    </div>
  );
}
