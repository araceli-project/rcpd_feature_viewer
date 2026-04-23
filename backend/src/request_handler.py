import os

import eisp
from extract_features import extract_features_from_list_of_ndarrays, extract_features_no_infer_from_list_of_ndarrays
from sklearn.manifold import TSNE
import numpy as np
from sklearn.metrics import balanced_accuracy_score
import uuid
import xgboost as xgb


def _to_python_types(value):
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    if isinstance(value, dict):
        return {k: _to_python_types(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_to_python_types(v) for v in value]
    return value


def _sanitize_features(features: np.ndarray) -> np.ndarray:
    clean_features = np.asarray(features, dtype=np.float64)
    finite_mask = np.isfinite(clean_features)
    if finite_mask.all():
        return clean_features

    col_means = np.nanmean(np.where(finite_mask, clean_features, np.nan), axis=0)
    col_means = np.nan_to_num(col_means, nan=0.0, posinf=0.0, neginf=0.0)
    clean_features = clean_features.copy()
    invalid_rows, invalid_cols = np.where(~finite_mask)
    clean_features[invalid_rows, invalid_cols] = col_means[invalid_cols]
    return clean_features


def process_images(list_of_ndarray: list, csai_model_name: str = ""):
    feature_vectors = extract_features_from_list_of_ndarrays(list_of_ndarray)
    inference_results = feature_vectors.inference_results
    if csai_model_name:
        if not os.path.exists(f"csai_model/{csai_model_name}.json"):
            raise FileNotFoundError(f"Model {csai_model_name} not found in csai_model directory.")
        model = xgb.XGBClassifier()
        model.load_model(f"csai_model/{csai_model_name}.json")
        concatenated_features = np.concatenate(list(feature_vectors.get_all_features().values()), axis=1)
        csai_results = np.round(model.predict(concatenated_features))
        inference_results["csai"] = ["CSAI" if pred == 1 else "Non-CSAI" for pred in csai_results]

    features_pca: eisp.proxy_tasks.FeatureVectors = feature_vectors.apply_pca()[0]

    features_dict = {
        name: _sanitize_features(features)
        for name, features in features_pca.get_all_features().items()
    }

    # Process with TSNE
    concatenated_features = np.concatenate(list(features_dict.values()), axis=1)
    features_dict["Concatenated"] = _sanitize_features(concatenated_features)

    for name, features in features_dict.items():
        if features.shape[0] < 2 or features.shape[1] <= 2:
            continue  # Skip TSNE if there are less than 3 of dimension
        perplexity = min(30, features.shape[0] - 1)
        if perplexity <= 0:
            continue
        tsne = TSNE(n_components=2, random_state=42, perplexity=perplexity)
        print(features.shape)
        print(f"Applying TSNE to {name} features...")

        features_dict[name] = tsne.fit_transform(features)

    return features_dict, inference_results

def train_model(list_of_ndarray: list, labels: list[bool], model_name: str = uuid.uuid4().hex):
    print("Starting feature extraction for training...")
    feature_vectors = extract_features_no_infer_from_list_of_ndarrays(list_of_ndarray)
    print("Feature extraction completed. Starting training...")
    ensemble = eisp.ensemble.Ensemble(feature_vectors, np.array(labels))
    params = {
        "objective": "binary:logistic",
        "seed": 42,
        "learning_rate": 0.1,
        "max_depth": 6,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
    }
    ensemble.train(
        model_type="xgboost",
        optimization_trials=5,
        optimization_direction="maximize",
        metric_function=lambda y_true, y_pred: balanced_accuracy_score(
            y_true, np.round(y_pred)
        ),
        should_extract_shap=True,
        hyperparams=params,
    )

    print("Training completed. Saving model...")
    # Save the trained model to disk
    os.makedirs("csai_model", exist_ok=True)
    ensemble.model.save_model(f"csai_model/{model_name}.json")

    shap_agg = ensemble.shap_aggregated
    val_metric = ensemble.val_metric
    print("Model saved.")
    return _to_python_types({
        "shap_agg": shap_agg,
        "test_metric": val_metric,
        "model_name": model_name,
    })
