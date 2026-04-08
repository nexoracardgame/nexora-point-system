import cv2
import os

CARDS_DIR = "../public/cards"
QUERY_IMAGE = "query.jpg"  # รูปที่ผู้ใช้ถ่ายมา

orb = cv2.ORB_create(1000)
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

query = cv2.imread(QUERY_IMAGE, 0)
kp1, des1 = orb.detectAndCompute(query, None)

best_score = 0
best_card = None

for filename in os.listdir(CARDS_DIR):
    path = os.path.join(CARDS_DIR, filename)
    train = cv2.imread(path, 0)

    if train is None:
        continue

    kp2, des2 = orb.detectAndCompute(train, None)

    if des2 is None:
        continue

    matches = bf.match(des1, des2)
    score = len(matches)

    if score > best_score:
        best_score = score
        best_card = filename

print("Best Match:", best_card)
print("Score:", best_score)