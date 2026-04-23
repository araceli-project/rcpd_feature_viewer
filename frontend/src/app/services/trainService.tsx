export type TrainResponse = {
  shap_agg: number[];
  test_metric: number;
  model_name: string;
};

function getBackendBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (envUrl) {
    try {
      return new URL(envUrl).toString().replace(/\/$/, "");
    } catch {
      throw new Error(
        "Invalid NEXT_PUBLIC_BACKEND_URL. Expected a full URL like http://127.0.0.1:8000",
      );
    }
  }
  return "http://127.0.0.1:8000";
}

function postMultipartWithXhr(url: string, body: FormData): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.responseType = "text";
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(request.responseText);
        return;
      }
      reject(
        new Error(
          `Train request failed (${request.status}): ${
            request.responseText || request.statusText
          }`,
        ),
      );
    };
    request.onerror = () => {
      reject(
        new Error(
          `Browser failed to read response from ${url}. The backend may still be processing the training job.`,
        ),
      );
    };
    request.onabort = () => {
      reject(new Error(`Train request to ${url} was aborted.`));
    };
    request.send(body);
  });
}

export async function postTrain(
  files: FileList,
  targetLabelsFile: File,
): Promise<TrainResponse> {
  const fileArray = Array.from(files).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (fileArray.length === 0) {
    throw new Error("At least one training image is required.");
  }

  const labelsText = await targetLabelsFile.text();
  let parsedLabels: unknown;
  try {
    parsedLabels = JSON.parse(labelsText);
  } catch {
    throw new Error("Target labels file must contain valid JSON.");
  }

  if (
    !Array.isArray(parsedLabels) ||
    !parsedLabels.every((x) => typeof x === "boolean")
  ) {
    throw new Error("Target labels file must be a JSON array of booleans.");
  }

  const formData = new FormData();
  for (const file of fileArray) {
    formData.append("files", file);
  }
  formData.append("payload", JSON.stringify(parsedLabels));

  const trainUrl = `${getBackendBaseUrl()}/train`;

  let responseText: string;
  try {
    responseText = await postMultipartWithXhr(trainUrl, formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request to ${trainUrl} failed: ${message}`);
  }

  let result: TrainResponse;
  try {
    result = JSON.parse(responseText) as TrainResponse;
  } catch {
    throw new Error(
      `Train request succeeded but returned invalid JSON: ${responseText}`,
    );
  }

  return {
    shap_agg: result.shap_agg,
    test_metric: result.test_metric,
    model_name: result.model_name,
  };
}
