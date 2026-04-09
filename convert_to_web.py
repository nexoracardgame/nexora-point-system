import os
import tensorflow as tf
import tensorflowjs as tfjs

# ✅ โหลดโมเดล 293 ใบล่าสุด
model = tf.keras.models.load_model("nexora_ai_model.keras")

# ✅ export ไปเว็บ
output_dir = "public/model"
os.makedirs(output_dir, exist_ok=True)

# ✅ IMPORTANT: ต้องใช้ save_keras_model
tfjs.converters.save_keras_model(model, output_dir)

print("🔥 WEB MODEL READY 293")