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
  let response: Response;
  try {
    response = await fetch(featuresUrl, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network request to ${featuresUrl} failed: ${message}`);
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(
      `Features request failed (${response.status}): ${
        responseText || response.statusText
      }`,
    );
  }

  return (await response.json()) as FeaturesResponse;
}

export function getClassificationData(
  response: FeaturesResponse,
): Record<string, string[]> {
  const classificationTaskNames = new Set([
    "Scenes_Places",
    "Nudity",
    "ITA_Skin_Tone",
    "Ita_Skin_tone",
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
  _response: FeaturesResponse,
): Record<string, string[][]> {
  const multipleResultsData: Record<string, string[][]> = {};
  return multipleResultsData;
}
