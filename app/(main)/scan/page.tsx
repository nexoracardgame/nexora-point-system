# ai_server.py
# 🚀 NEXORA AI Scanner v2
# High Accuracy Mobile + Edge Number Boost 001-293

from fastapi import FastAPI
from pydantic import BaseModel
import base64
import cv2
import numpy as np
import json

app = FastAPI()


# =========================
# LOAD CARD VECTORS
# =========================
with open("card-vectors.json", "r", encoding="utf-8") as f:
    CARD_VECTORS = json.load(f)


class ScanRequest(BaseModel):
    image: str


# =========================
# HELPERS
# =========================
def decode_base64_image(data_url: str):
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]

    img_bytes = base64.b64decode(data_url)
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def cosine_similarity(a, b):
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8
    return float(np.dot(a, b) / denom)


# =========================
# EDGE NUMBER EXTRACTION
# =========================
def extract_number_rois(img: np.ndarray):
    h, w = img.shape[:2]

    top_left = img[
        0 : int(h * 0.18),
        0 : int(w * 0.35),
    ]

    bottom_right = img[
        int(h * 0.82) : h,
        int(w * 0.65) : w,
    ]

    return top_left, bottom_right


def preprocess_number_roi(roi: np.ndarray):
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # 🚀 เพิ่ม contrast ให้เลขคม
    gray = cv2.convertScaleAbs(
        gray,
        alpha=1.9,
        beta=10,
    )

    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    th = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        21,
        6,
    )

    return th


def signature_from_binary(binary: np.ndarray):
    small = cv2.resize(binary, (32, 16))
    return (
        small.astype(np.float32).flatten() / 255.0
    )


# =========================
# MAIN SIGNATURE
# =========================
def build_signature(img: np.ndarray):
    # 🎨 artwork ทั้งใบ
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.resize(gray, (96, 128))

    main_sig = (
        gray.astype(np.float32).flatten() / 255.0
    )

    # 🔢 เลขขอบ
    tl, br = extract_number_rois(img)

    tl_sig = signature_from_binary(
        preprocess_number_roi(tl)
    )

    br_sig = signature_from_binary(
        preprocess_number_roi(br)
    )

    # 🚀 รวมเป็น signature เดียว
    return np.concatenate(
        [
            main_sig,
            tl_sig,
            br_sig,
        ]
    )


# =========================
# API
# =========================
@app.post("/predict")
def predict(req: ScanRequest):
    try:
        # warmup route
        if req.image == "warmup":
            return {"ok": True}

        img = decode_base64_image(req.image)

        if img is None:
            return {
                "cardNo": None,
                "confidence": 0,
            }

        query_sig = build_signature(img)

        best_card = None
        best_score = -1

        for item in CARD_VECTORS:
            vec = np.array(
                item["vector"],
                dtype=np.float32,
            )

            score = cosine_similarity(
                query_sig,
                vec,
            )

            # 🚀 boost เฉพาะเลขจริง 001-293
            card_no = str(
                item.get("cardNo", "")
            ).zfill(3)

            if card_no.isdigit():
                n = int(card_no)

                if 1 <= n <= 293:
                    score += 0.025

            if score > best_score:
                best_score = score
                best_card = item

        return {
            "cardNo": (
                best_card.get("cardNo")
                if best_card
                else None
            ),
            "confidence": round(
                float(best_score),
                4,
            ),
        }

    except Exception as e:
        return {
            "cardNo": None,
            "confidence": 0,
            "error": str(e),
        }