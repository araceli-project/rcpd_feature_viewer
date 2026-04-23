export type FeaturesResponse = {
  features: Record<string, [number, number][]>;
  inference_results: Record<
    string,
    (string | string[] | string[][] | object)[]
  >;
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
          `Features request failed (${request.status}): ${
            request.responseText || request.statusText
          }`,
        ),
      );
    };
    request.onerror = () => {
      reject(
        new Error(
          `Browser failed to read response from ${url}. The backend may still be processing the features job.`,
        ),
      );
    };
    request.onabort = () => {
      reject(new Error(`Features request to ${url} was aborted.`));
    };
    request.send(body);
  });
}

export async function postFeatures(
  files: File[] | FileList,
  modelName?: string,
): Promise<FeaturesResponse> {
  const fileArray = Array.from(files);
  if (fileArray.length === 0) {
    throw new Error("At least one file is required.");
  }

  const formData = new FormData();
  for (const file of fileArray) {
    formData.append("images", file);
  }

  if (modelName && modelName.trim().length > 0) {
    formData.append("model_name", modelName.trim());
  }

  const featuresUrl = `${getBackendBaseUrl()}/features`;
  let responseText: string;
  try {
    responseText = await postMultipartWithXhr(featuresUrl, formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request to ${featuresUrl} failed: ${message}`);
  }

  let result: FeaturesResponse;
  try {
    result = JSON.parse(responseText) as FeaturesResponse;
  } catch {
    throw new Error(
      `Features request succeeded but returned invalid JSON: ${responseText}`,
    );
  }

  return result;
}

export function getClassificationData(
  response: FeaturesResponse,
): Record<string, string[]> {
  const classificationTaskNames = new Set([
    "Scenes_Places",
    "Nudity",
    "csai",
  ]);

  const toLabel = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? toLabel(value[0]) : "Unknown";
    }
    return "Unknown";
  };

  const classificationData: Record<string, string[]> = {};
  for (const [taskName, results] of Object.entries(
    response.inference_results,
  )) {
    if (!classificationTaskNames.has(taskName)) {
      continue;
    }
    classificationData[taskName] = results.map((result) => toLabel(result));
  }

  return classificationData;
}

export function getMultipleResultsData(
  response: FeaturesResponse,
): Record<string, string[][]> {
  const multipleResultsTaskNames = new Set(["Objects", "ITA_Skin_Tone", "age", "child", "gender"]);
  const multipleResultsData: Record<string, string[][]> = {};

  const toStringArray = (value: unknown): string[] => {
    if (typeof value === "string") {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => toStringArray(item));
    }
    return [];
  };


  for (const [taskName, results] of Object.entries(response.inference_results)) {
    if (!multipleResultsTaskNames.has(taskName)) {
      continue;
    }

    multipleResultsData[taskName] = results.map((result) => {
      const values = toStringArray(result);
      return values.length > 0 ? values : ["unknown"];
    });
  }

  return multipleResultsData;
}
