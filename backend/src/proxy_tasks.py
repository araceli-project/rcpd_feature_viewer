from ultralytics import YOLO
from transformers import ViTImageProcessor, AutoModelForImageClassification, DeiTModel
import numpy as np
from facenet_pytorch import MTCNN
import logging
import torchvision
from torchvision import transforms as trn
import torch
from torch.autograd import Variable as V
from PIL import Image
from torch.nn import functional as F

import keras
from keras.models import model_from_json

from tensorflow import compat as compat
from itamodel import SkinTone
from tensorflow.python.keras import backend as K
from skimage import transform

tf = compat.v1


mtcnn_model = MTCNN(keep_all=True)


def get_object_model():
    objects_model = YOLO("models/objects/yolov11.pt", verbose=False)
    return {"model": objects_model}


def get_pose_model():
    pose_model = YOLO("models/pose/yolov11pose.pt", verbose=False)
    return {"model": pose_model}

def get_nsfw_model():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    nsfw_processor = ViTImageProcessor.from_pretrained(
        "AdamCodd/vit-base-nsfw-detector"
    )
    nsfw_model = AutoModelForImageClassification.from_pretrained(
        "AdamCodd/vit-base-nsfw-detector"
    ).to(device)
    return {"device": device, "processor": nsfw_processor, "model": nsfw_model}


def get_scene_model():
    # th architecture to use
    arch = "alexnet"
    # load the pre-trained weights
    model_file = "models/scenes/alexnet_places365.pth.tar"
    scene_model = torchvision.models.__dict__[arch](num_classes=365)
    checkpoint = torch.load(model_file, map_location=lambda storage, loc: storage)
    state_dict = {
        str.replace(k, "module.", ""): v for k, v in checkpoint["state_dict"].items()
    }
    scene_model.load_state_dict(state_dict)
    scene_model.eval()
    return {"model": scene_model}


def get_scene_thamiris_model():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    scene_thamiris_state_dict = torch.load(
        "models/scenes_thamiris/thamiris_FSL_places600_best.pth", map_location=device, weights_only=False
    )
    scene_thamiris_state_dict = scene_thamiris_state_dict['model']
    scene_thamiris_state_dict = {k.replace("backbone.", ""): v for k, v in scene_thamiris_state_dict.items()}

    scene_thamiris_model = DeiTModel.from_pretrained("facebook/deit-small-distilled-patch16-224")
    scene_thamiris_model.load_state_dict(scene_thamiris_state_dict)
    return {"device": device, "model": scene_thamiris_model}


def get_age_model():
    tf.disable_v2_behavior()
    age_model = model_from_json(
        open("models/model_age/vgg16_agegender_model.json").read()
    )
    return {"mtcnn": mtcnn_model, "model": age_model}


def get_ita_model():
    skin_model = SkinTone("models/fitzpatrick/shape_predictor_68_face_landmarks.dat")
    return {"mtcnn": mtcnn_model, "model": skin_model}


def get_age_gender_vector(batch, mtcnn, model=None):

    if model is None:
        tf.disable_v2_behavior()
        model = model_from_json(
            open("models/model_age/vgg16_agegender_model.json").read()
        )

    feature_dim = 4096
    batch_age_gender_vector = np.zeros((len(batch), feature_dim), dtype=np.float32)

    config = tf.ConfigProto(device_count={"GPU": 0})
    sess = tf.Session(config=config)
    K.set_session(sess)

    with sess:
        model.load_weights("models/model_age/vgg16_agegender.hdf5")
        age_and_feature_model = keras.Model(
            inputs=model.input,
            outputs=[model.output[0], model.get_layer("fc2").output],
        )

        for i, image in enumerate(batch):
            faces = get_face_imgs(image, mtcnn=mtcnn)
            if len(faces) == 0:
                continue

            prepared_faces = []
            for face in faces:
                if face.shape[0] == 3:
                    face = face.transpose((1, 2, 0))
                face = transform.resize(face, (128, 128), preserve_range=True)
                prepared_faces.append(face.astype(np.float32))

            face_batch = np.stack(prepared_faces, axis=0)
            age_probs, face_features = age_and_feature_model.predict(face_batch, verbose=0)
            age_bins = np.argmax(age_probs, axis=1)
            selected_face_idx = int(np.argmin(age_bins))
            batch_age_gender_vector[i] = face_features[selected_face_idx]

    return batch_age_gender_vector


def get_ita_vector(batch, mtcnn, model=None):
    if model is None:
        model = SkinTone("models/fitzpatrick/shape_predictor_68_face_landmarks.dat")

    features = np.zeros((len(batch), 1), dtype=np.float32)
    for i, image in enumerate(batch):
        faces = get_face_imgs(image, mtcnn=mtcnn)
        if len(faces) == 0:
            continue

        ita_values = []
        for face in faces:
            if face.shape[0] == 3:
                face = face.transpose((1, 2, 0))
            ita, _ = model.ITA(face)
            ita_values.append(float(ita))

        features[i, 0] = float(np.mean(ita_values))

    return features


def get_face_imgs(img, mtcnn=None):
    img = img.permute(1, 2, 0)  # Convert from CHW to HWC format
    if mtcnn is None:
        mtcnn = MTCNN(keep_all=True)

    faces = mtcnn(img)
    # logging.info("FACES")
    if faces is None:
        # logging.info("No faces detected")
        return []

    faces = faces.numpy().astype(np.float32)
    # facenet-pytorch can return standardized faces in [-1, 1]. Convert safely to [0, 255].
    if np.min(faces) < 0:
        faces = (faces * 128.0) + 127.5
    elif np.max(faces) <= 1.0:
        faces = faces * 255.0
    faces = np.clip(faces, 0.0, 255.0).astype(np.uint8)
    # logging.info(f"Detected {len(faces)} faces")

    return faces


def get_objects_vector(batch, model=None):
    if model is None:
        model = YOLO("models/objects/yolov11.pt", verbose=False)

    layer = model.model.model[8]
    hook_handles = []
    features = []

    def hook(_, __, output):
        features.append(output.detach())

    hook_handles.append(layer.register_forward_hook(hook))
    batch = batch.float() / 255.0  # Normalize the batch

    model(batch)

    for handle in hook_handles:
        handle.remove()
    logging.info("Object detection feature processed")
    feature = features[-1]
    feature = feature.reshape((feature.shape[0], feature.shape[1], -1)).mean(dim=(2))
    feature = feature.cpu().numpy()
    logging.info(f"Object feature shape: {feature.shape}")
    return feature


def get_pose_vector(batch, model=None):
    if model is None:
        model = YOLO("models/pose/yolov11pose.pt", verbose=False)

    layer = model.model.model[8]
    hook_handles = []
    features = []

    def hook(_, __, output):
        features.append(output.detach())

    hook_handles.append(layer.register_forward_hook(hook))
    batch = batch.float() / 255.0  # Normalize the batch

    model(batch)

    for handle in hook_handles:
        handle.remove()
    logging.info("Pose estimation feature processed")
    feature = features[-1]
    feature = feature.reshape((feature.shape[0], feature.shape[1], -1)).mean(dim=(2))
    feature = feature.cpu().numpy()
    logging.info(f"Pose feature shape: {feature.shape}")
    return feature


def get_nsfw_vector(batch, device=None, processor=None, model=None):
    if device is None:
        if model is not None:
            device = next(model.parameters()).device
        else:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if processor is None or model is None:
        processor = ViTImageProcessor.from_pretrained("AdamCodd/vit-base-nsfw-detector")
        model = AutoModelForImageClassification.from_pretrained(
            "AdamCodd/vit-base-nsfw-detector"
        ).to(device)
    else:
        model = model.to(device)

    model.eval()
    pixel_values = processor(images=batch, return_tensors="pt")["pixel_values"].to(device)
    with torch.inference_mode():
        vit_outputs = model.vit(pixel_values=pixel_values, return_dict=True)

    logging.info("NSFW feature processed")
    feature = vit_outputs.last_hidden_state[:, 0, :].cpu().numpy()
    logging.info(f"NSFW feature shape: {feature.shape}")
    return feature


def get_scene_vector(batch, model=None):
    features = []

    def hook(_, __, output):
        features.append(output.detach())

    if model is None:
        # th architecture to use
        arch = "alexnet"
        # load the pre-trained weights
        model_file = "models/scenes/alexnet_places365.pth.tar"
        model = torchvision.models.__dict__[arch](num_classes=365)
        checkpoint = torch.load(model_file, map_location=lambda storage, loc: storage)
        state_dict = {
            str.replace(k, "module.", ""): v
            for k, v in checkpoint["state_dict"].items()
        }
        model.load_state_dict(state_dict)

    model.eval()

    # load the image transformer
    centre_crop = trn.Compose(
        [
            trn.Resize((256, 256)),
            trn.CenterCrop(224),
            trn.ToTensor(),
            trn.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    # load the class label
    file_name = "models/scenes/categories_places365.txt"
    classes = list()
    with open(file_name) as class_file:
        for line in class_file:
            classes.append(line.strip().split(" ")[0][3:])
    classes = tuple(classes)

    handle = model.features[-1].register_forward_hook(hook)
    for img in batch:
        img = img.permute(1, 2, 0).numpy()
        if img.dtype != np.uint8:
            img = (img * 255).astype(np.uint8)
        img = Image.fromarray(img)
        img = centre_crop(img).unsqueeze(0)
        input_img = V(img)

        # forward pass
        model.forward(input_img)
    handle.remove()
    logging.info("Scene Classification feature processed")
    feature = torch.cat(features, dim=0).cpu().numpy()
    feature = feature.reshape((feature.shape[0], feature.shape[1], -1))
    feature = feature.mean(axis=(2))
    logging.info(feature.shape)

    return feature


def get_scene_thamiris_vector(batch, device, model=None):
    if model is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        scene_thamiris_state_dict = torch.load(
            "models/scenes_thamiris/thamiris_FSL_places600_best.pth", map_location=device
        )
        scene_thamiris_state_dict = scene_thamiris_state_dict['model']
        scene_thamiris_state_dict = {k.replace("backbone.", ""): v for k, v in scene_thamiris_state_dict.items()}

        scene_thamiris_model = DeiTModel.from_pretrained("facebook/deit-small-distilled-patch16-224")
        scene_thamiris_model.load_state_dict(scene_thamiris_state_dict)
        model = scene_thamiris_model

    model.to(device)
    batch = batch.float() / 255.0  # Normalize the batch
    batch = batch.to(device)
    with torch.no_grad():
        batch_resize = torch.nn.functional.interpolate(batch, size=(224, 224), mode='bilinear', align_corners=False)
        feature = model(batch_resize)
        feature = feature[0][:, 0, :]
    logging.info("Scene Classification with Few Shot Model feature processed")
    logging.info(feature.shape)
    feature = feature.cpu().numpy()
    return feature

def infer_objects(batch, model=None):
    if model is None:
        model = YOLO("models/objects/yolov11.pt", verbose=False)

    batch = batch.float() / 255.0  # Normalize the batch
    results = model(batch)
    names_per_image = [
        [result.names[int(cls)] for cls in result.boxes.cls.int().tolist()]
        for result in results
    ]
    logging.info("Object inference processed")
    return names_per_image


def infer_nsfw(batch, device=None, processor=None, model=None):
    if device is None:
        if model is not None:
            device = next(model.parameters()).device
        else:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if processor is None or model is None:
        processor = ViTImageProcessor.from_pretrained("AdamCodd/vit-base-nsfw-detector")
        model = AutoModelForImageClassification.from_pretrained(
            "AdamCodd/vit-base-nsfw-detector"
        ).to(device)
    else:
        model = model.to(device)

    inputs = processor(images=batch, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model(**inputs)
    probs = torch.nn.functional.softmax(outputs.logits, dim=1)
    results = [
        "NSFW" if prob[1] > prob[0] else "SFW" for prob in probs.cpu().numpy()
    ]
    logging.info("NSFW inference processed")
    return results


def infer_scenes(batch, model=None):
    if model is None:
        model = get_scene_model()["model"]

    # load the image transformer
    centre_crop = trn.Compose(
        [
            trn.Resize((256, 256)),
            trn.CenterCrop(224),
            trn.ToTensor(),
            trn.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ]
    )

    # load the class label
    file_name = "models/scenes/categories_places365.txt"
    classes = list()
    with open(file_name) as class_file:
        for line in class_file:
            classes.append(line.strip().split(" ")[0][3:])
    classes = tuple(classes)


    results = []
    for img in batch:
        img = img.permute(1, 2, 0).numpy()  # Convert from CHW to HWC format
        if img.dtype != np.uint8:
            img = (img * 255).astype(np.uint8)
        img = Image.fromarray(img)
        img = centre_crop(img).unsqueeze(0)
        input_img = V(img)

        # forward pass
        logit = model.forward(input_img)
        h_x = F.softmax(logit, 1).data.squeeze()
        probs, idx = h_x.sort(0, True)
        results.append(classes[idx[0]])
    logging.info("Scene inference processed")
    return results


def infer_age_gender(batch, mtcnn=None, model=None):
    timespans = ["(0-2)", "(4-6)", "(8-13)", "(15-20)", "(25-30)", "(38-43)", "(48-53)", "(60+)"]
    if mtcnn is None:
        mtcnn = mtcnn_model

    if model is None:
        tf.disable_v2_behavior()
        model = model_from_json(
            open("models/model_age/vgg16_agegender_model.json").read()
        )

    config = tf.ConfigProto(device_count={"GPU": 0})
    sess = tf.Session(config=config)
    K.set_session(sess)

    age = []
    child = []
    gender = []
    with sess:
        model.load_weights("models/model_age/vgg16_agegender.hdf5")

        for i, image in enumerate(batch):
            faces = get_face_imgs(image, mtcnn=mtcnn)
            if len(faces) == 0:
                age.append(["no_faces"])
                child.append(["no_faces"])
                gender.append(["no_faces"])
                continue

            predictions = []
            for j, face in enumerate(faces):
                if face.shape[0] == 3:
                    face = face.transpose((1, 2, 0))
                face = transform.resize(face, (128, 128))
                preds = model.predict(face[None, :, :, :])
                predictions.append(
                    (
                        timespans[np.argmax(preds[0][0])],
                        "child" if preds[1][0][0].item() > 0.5 else "adult",
                        "male" if preds[2][0][0].item() < 0.5 else "female",
                    )
                )
                # save face as image for debugging
                # face_img = Image.fromarray(np.clip(face * 255.0, 0, 255).astype(np.uint8))
                # face_img.save(f"debug_face_{i}_{j}_{predictions[-1][2]}.jpg")


            age_i = [predictions[i][0] for i in range(len(predictions))]
            child_i = [predictions[i][1] for i in range(len(predictions))]
            gender_i = [predictions[i][2] for i in range(len(predictions))]
            age.append(age_i)
            child.append(child_i)
            gender.append(gender_i)

    return [age, child, gender]


def infer_ita(batch, mtcnn=None, model=None):
    if mtcnn is None:
        mtcnn = mtcnn_model
    if model is None:
        model = SkinTone("models/fitzpatrick/shape_predictor_68_face_landmarks.dat")

    results = []
    for image in batch:
        faces = get_face_imgs(image, mtcnn=mtcnn)
        if len(faces) == 0:
            results.append(["no_faces"])
            continue

        ita_values = []
        for face in faces:
            if face.shape[0] == 3:
                face = face.transpose((1, 2, 0))
            ita, _ = model.ITA(face)
            try:
                ita_values.append(model.ita2str(float(ita))[0])
            except Exception as e:
                logging.error(f"Error converting ITA value to string: {e}")
        
        results.append(ita_values)

    return results


def infer_pose(batch, model=None):
    return ["not available"] * len(batch)


def infer_scene_thamiris(batch, device=None, model=None):
    return ["not available"] * len(batch)
