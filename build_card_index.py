import os
import json
from PIL import Image
import numpy as np

CARD_COUNT = 293
RGB_W, RGB_H = 56, 80
EDGE_W, EDGE_H = 40, 56
cards_dir = "public/cards"

def rgb_vector(img, size):
    img = img.resize(size).convert("RGB")
    arr = np.asarray(img).astype(np.float32) / 255.0
    return arr.reshape(-1).tolist()

def edge_vector(img, size):
    img = img.resize(size).convert("L")
    arr = np.asarray(img).astype(np.float32) / 255.0
    gx = np.zeros_like(arr)
    gy = np.zeros_like(arr)
    gx[:, 1:-1] = arr[:, 2:] - arr[:, :-2]
    gy[1:-1, :] = arr[2:, :] - arr[:-2, :]
    edge = np.sqrt(gx**2 + gy**2)
    return edge.reshape(-1).tolist()

def histogram(img):
    img = img.resize((RGB_W, RGB_H)).convert("RGB")
    arr = np.asarray(img)
    hist, _ = np.histogramdd(
        arr.reshape(-1, 3),
        bins=(8, 8, 8),
        range=((0,255),(0,255),(0,255))
    )
    return hist.reshape(-1).astype(float).tolist()

items = []

for i in range(1, CARD_COUNT + 1):
    card_no = str(i).zfill(3)
    path = os.path.join(cards_dir, f"{card_no}.jpg")
    if not os.path.exists(path):
        continue

    img = Image.open(path)
    items.append({
        "cardNo": card_no,
        "rgb": rgb_vector(img, (RGB_W, RGB_H)),
        "edge": edge_vector(img, (EDGE_W, EDGE_H)),
        "hist": histogram(img)
    })

with open("public/card-index.json", "w", encoding="utf-8") as f:
    json.dump({"items": items}, f)

print("🔥 card-index.json READY")