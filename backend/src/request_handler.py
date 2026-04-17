import eisp
from extract_features import extract_features_from_list_of_ndarrays
from sklearn.manifold import TSNE
import numpy as np

def process_images(list_of_ndarray: list):
    feature_vectors = extract_features_from_list_of_ndarrays(list_of_ndarray)
    inference_results = feature_vectors.inference_results
    features_pca: eisp.proxy_tasks.FeatureVectors = feature_vectors.apply_pca()[0]
    features_dict = features_pca.get_all_features()

    # Process with TSNE
    concatenated_features = np.concatenate(list(features_dict.values()), axis=1)
    features_dict["Concatenated"] = concatenated_features

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
