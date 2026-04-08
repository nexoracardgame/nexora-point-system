import tensorflow as tf
from tensorflow.keras import layers

IMG_SIZE = (224, 224)
BATCH_SIZE = 16

dataset = tf.keras.utils.image_dataset_from_directory(
    "ai-dataset",
    image_size=IMG_SIZE,
    batch_size=BATCH_SIZE,
)

num_classes = len(dataset.class_names)

augment = tf.keras.Sequential([
    layers.RandomFlip("horizontal"),
    layers.RandomRotation(0.08),
    layers.RandomZoom(0.15),
    layers.RandomContrast(0.15),
])

model = tf.keras.Sequential([
    layers.Input(shape=(224, 224, 3)),
    augment,
    layers.Rescaling(1./255),

    layers.Conv2D(32, 3, activation="relu"),
    layers.MaxPooling2D(),

    layers.Conv2D(64, 3, activation="relu"),
    layers.MaxPooling2D(),

    layers.Conv2D(128, 3, activation="relu"),
    layers.MaxPooling2D(),

    layers.Flatten(),
    layers.Dense(256, activation="relu"),
    layers.Dropout(0.3),
    layers.Dense(num_classes, activation="softmax"),
])

model.compile(
    optimizer="adam",
    loss="sparse_categorical_crossentropy",
    metrics=["accuracy"]
)

model.fit(dataset, epochs=20)

# ✅ เซฟ keras model ก่อน
model.save("nexora_saved_model", save_format="tf")
print("🔥 SAVED MODEL READY")

print("🔥 TRAIN COMPLETE")