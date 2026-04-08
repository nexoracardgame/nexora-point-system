import tensorflow as tf
from keras.models import load_model

custom_objects = {
    "RandomFlip": tf.keras.layers.Layer,
    "RandomZoom": tf.keras.layers.Layer,
    "RandomRotation": tf.keras.layers.Layer,
    "RandomContrast": tf.keras.layers.Layer,
}

model = load_model(
    "nexora_ai_model.keras",
    custom_objects=custom_objects,
    compile=False,
)

model.export("nexora_saved_model")

print("🔥 MODEL RE-SAVED")