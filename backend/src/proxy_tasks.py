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

    batch_age_gender_vector = []

    config = tf.ConfigProto(device_count={"GPU": 0})
    sess = tf.Session(config=config)
    K.set_session(sess)

    with sess:
        model.load_weights("models/model_age/vgg16_agegender.hdf5")
        feature_model = keras.Model(
            inputs=model.input,
            outputs=model.get_layer("fc2").output,
        )

        for i, image in enumerate(batch):
            faces = get_face_imgs(image, mtcnn=mtcnn)
            features = []
            if len(faces) != 0:
                for face in faces:
                    if face.shape[0] == 3:
                        face = face.transpose((1, 2, 0))
                    face = transform.resize(face, (128, 128))
                    preds = model.predict(face[None, :, :, :])
                    age = preds[0][0].tolist()
                    index_with_max_prob = np.argmax(age)
                    features.append(
                        (
                            index_with_max_prob,
                            feature_model.predict(face[None, :, :, :]),
                        )
                    )
                features = sorted(features, key=lambda x: x[0])
                batch_age_gender_vector.append(features[0][1])

            else:
                batch_age_gender_vector.append(np.zeros((1, 4096)))
    features = np.array(batch_age_gender_vector).squeeze()

    return features


def get_ita_vector(batch, mtcnn, model=None):
    if model is None:
        model = SkinTone("models/fitzpatrick/shape_predictor_68_face_landmarks.dat")

    batch_ita_vector = []

    config = tf.ConfigProto(device_count={"GPU": 0})
    sess = tf.Session(config=config)
    K.set_session(sess)

    with sess:
        for i, image in enumerate(batch):
            faces = get_face_imgs(image, mtcnn=mtcnn)
            skin_ita = []
            if len(faces) != 0:
                for face in faces:
                    if face.shape[0] == 3:
                        face = face.transpose((1, 2, 0))
                    ita, patch = model.ITA(face)
                    skin_ita.append(ita)
                skin_ita = np.array(skin_ita)
                batch_ita_vector.append(
                    np.mean(skin_ita, axis=0, keepdims=True).reshape((1, 1))
                )
            else:
                batch_ita_vector.append(np.zeros((1, 1)))
    features = np.array(batch_ita_vector).squeeze(axis=2)

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

    faces = (faces.numpy() * 255).astype(np.uint8)
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
    if processor is None or model is None:
        processor = ViTImageProcessor.from_pretrained("AdamCodd/vit-base-nsfw-detector")
        model = AutoModelForImageClassification.from_pretrained(
            "AdamCodd/vit-base-nsfw-detector"
        ).to(device)

    features = []

    def hook(_, __, output):
        features.append(output.detach())

    handle = model.vit.layernorm.register_forward_hook(hook)

    inputs = processor(images=batch, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    with torch.no_grad():
        model(**inputs)

    handle.remove()
    logging.info("NSFW feature processed")
    feature = features[0][:, 0, :]
    feature = feature.cpu().numpy()
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
    feature = np.array(features)
    if feature.shape[1] == 1:
        feature = feature.squeeze()
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
                age.append("unknown")
                child.append("unknown")
                gender.append("unknown")
                continue

            predictions = []
            for face in faces:
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


            age_i = [predictions[i][0] for i in range(len(predictions))]
            child_i = [predictions[i][1] for i in range(len(predictions))]
            gender_i = [predictions[i][2] for i in range(len(predictions))]
            age.append(age_i)
            child.append(child_i)
            gender.append(gender_i)

    return {"age": age, "child": child, "gender": gender}


def infer_ita(batch, mtcnn=None, model=None):
    if mtcnn is None:
        mtcnn = mtcnn_model
    if model is None:
        model = SkinTone("models/fitzpatrick/shape_predictor_68_face_landmarks.dat")

    results = []
    for image in batch:
        faces = get_face_imgs(image, mtcnn=mtcnn)
        if len(faces) == 0:
            results.append("unknown")
            continue

        ita_values = []
        for face in faces:
            if face.shape[0] == 3:
                face = face.transpose((1, 2, 0))
            ita, _ = model.ITA(face)
            ita_values.append(model.ita2str(float(ita))[0])
        
        results.append(ita_values)

    return results


def infer_pose(batch, model=None):
    return ["not available"] * len(batch)


def infer_scene_thamiris(batch, device=None, model=None):
    return ["not available"] * len(batch)
