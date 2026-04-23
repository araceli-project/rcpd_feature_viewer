import eisp
from torch.utils.data import Dataset, DataLoader
from torchvision.transforms import v2 as transforms

from proxy_tasks import (
    get_nsfw_vector,
    get_objects_vector,
    get_scene_vector,
    get_scene_thamiris_vector,
    get_age_gender_vector,
    get_ita_vector,
    get_pose_vector,
)
from proxy_tasks import (
    get_nsfw_model,
    get_object_model,
    get_scene_model,
    get_scene_thamiris_model,
    get_age_model,
    get_ita_model,
    get_pose_model,
)

from proxy_tasks import (
    infer_nsfw,
    infer_objects,
    infer_pose,
    infer_scenes,
    infer_scene_thamiris,
    infer_age_gender,
    infer_ita,
)


PROXY_FEATURES_FUNCTIONS = [
    get_pose_vector,
    get_nsfw_vector,
    get_objects_vector,
    get_scene_vector,
    get_scene_thamiris_vector,
    get_age_gender_vector,
    get_ita_vector,
]
PROXY_FEATURES_NAMES = [
    "Pose",
    "Nudity",
    "Objects",
    "Scenes_Places",
    "Scenes_Few_Shot",
    "Age_Gender",
    "ITA_Skin_Tone",
]
PROXY_FEATURES_ARGUMENTS_GENERATORS = [
    get_pose_model,
    get_nsfw_model,
    get_object_model,
    get_scene_model,
    get_scene_thamiris_model,
    get_age_model,
    get_ita_model,
]

PROXY_TASKS_INFER_FUNCTIONS = [
    infer_pose,
    infer_nsfw,
    infer_objects,
    infer_scenes,
    infer_scene_thamiris,
    infer_age_gender,
    infer_ita,
]


class DatasetFromListOfNDArray(Dataset):
    def __init__(self, list_of_ndarray: list, transform=None):
        self.list_of_ndarray = list_of_ndarray
        if transform is None:
            self.transform = transforms.Compose(
                [
                    transforms.ToImage(),
                    transforms.Resize((224, 224)),
                ]
            )

    def __len__(self):
        return len(self.list_of_ndarray)

    def __getitem__(self, idx):
        image = self.list_of_ndarray[idx]
        if self.transform:
            image = self.transform(image)
        return image, 0

def get_dataloader_from_list_of_ndarray(list_of_ndarray: list, batch_size: int = 32, shuffle: bool = False):
    dataset = DatasetFromListOfNDArray(list_of_ndarray)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=shuffle)
    return dataloader


def extract_features_from_list_of_ndarrays(list_of_ndarray: list) -> eisp.proxy_tasks.FeatureVectors:
    print("Extracting features...")

    dataloader = get_dataloader_from_list_of_ndarray(list_of_ndarray)


    proxy_features_arguments = [gen() for gen in PROXY_FEATURES_ARGUMENTS_GENERATORS]

    results: eisp.proxy_tasks.FeatureVectors = eisp.proxy_tasks.FeatureVectors.extract_and_infer(
        dataloader,
        PROXY_FEATURES_FUNCTIONS,
        PROXY_FEATURES_NAMES,
        proxy_features_arguments,
        PROXY_TASKS_INFER_FUNCTIONS
    )

    flattened_inference_results = {}
    for task_name, inference_result_batches in results.inference_results.items():
        if task_name == "Age_Gender":
            flattened_inference_results["age"] = [age_result for batch in inference_result_batches for age_result in batch[0]]
            flattened_inference_results["child"] = [child_result for batch in inference_result_batches for child_result in batch[1]]
            flattened_inference_results["gender"] = [gender_result for batch in inference_result_batches for gender_result in batch[2]]
            
        else:
            flattened_inference_results[task_name] = [result for batch in inference_result_batches for result in batch]
    results.inference_results = flattened_inference_results
        
    return results


def extract_features_no_infer_from_list_of_ndarrays(list_of_ndarray: list) -> eisp.proxy_tasks.FeatureVectors:
    print("Extracting features...")

    dataloader = get_dataloader_from_list_of_ndarray(list_of_ndarray)


    proxy_features_arguments = [gen() for gen in PROXY_FEATURES_ARGUMENTS_GENERATORS]

    return eisp.proxy_tasks.FeatureVectors.extract(
        dataloader,
        PROXY_FEATURES_FUNCTIONS,
        PROXY_FEATURES_NAMES,
        proxy_features_arguments,
    )
