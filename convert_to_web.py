import os
import tensorflow as tf

model = tf.keras.models.load_model("nexora_ai_model.keras")

output_dir = "public/model"
os.makedirs(output_dir, exist_ok=True)

tf.saved_model.save(model, output_dir)

print("🔥 WEB MODEL READY")