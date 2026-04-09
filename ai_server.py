from fastapi import FastAPI
from pydantic import BaseModel
import tensorflow as tf
import numpy as np
from PIL import Image
import io
import base64

app = FastAPI()

model = tf.keras.models.load_model("nexora-card-ai.keras")

class_names = [str(i).zfill(3) for i in range(1, 294)]

class ScanRequest(BaseModel):
    image: str

@app.post("/predict")
def predict(req: ScanRequest):
    try:
        image_data = req.image.split(",")[-1]
        img_bytes = base64.b64decode(image_data)

        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        image = image.resize((224, 224))

        arr = np.array(image) / 255.0
        arr = np.expand_dims(arr, axis=0)

        pred = model.predict(arr, verbose=0)[0]
        idx = int(np.argmax(pred))

        return {
            "cardNo": class_names[idx],
            "confidence": float(pred[idx]),
        }
    except Exception as e:
        return {
            "error": str(e)
        }