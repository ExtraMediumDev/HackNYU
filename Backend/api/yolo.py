# api/yolo.py
from flask import Blueprint, request, jsonify
import cv2
import numpy as np
import base64
from inference_sdk import InferenceHTTPClient
from dotenv import load_dotenv
import os
from collections import deque

load_dotenv()

yolo_bp = Blueprint('yolo_bp', __name__)

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
if not ROBOFLOW_API_KEY:
    raise ValueError("ROBOFLOW_API_KEY not set in environment variables")

# Initialize Roboflow Inference API clients
drowsiness_client = InferenceHTTPClient(
    api_url="https://detect.roboflow.com",
    api_key=ROBOFLOW_API_KEY
)
drowsiness_model_id = "drowsy-kss/77"

stress_client = InferenceHTTPClient(
    api_url="https://classify.roboflow.com",
    api_key=ROBOFLOW_API_KEY
)
stress_model_id = "stress-detection-fj4xx/1"

# Define history lengths (in frames) for our thresholds.
SLEEP_HISTORY_LENGTH = 10     # 10 consecutive frames for sleep alert

# For stress detection, we want 8 consecutive frames with confidence >= 0.75.
STRESS_CONSECUTIVE_LIMIT = 8
MINIMUM_STRESS_CONFIDENCE = 0.75

# Global deques to store the last N detections.
sleep_history = deque(maxlen=SLEEP_HISTORY_LENGTH)
stress_history = deque(maxlen=STRESS_CONSECUTIVE_LIMIT)

@yolo_bp.route('/predict', methods=['POST'])
def predict():
    # Verify that an image is provided
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400

    # Read and decode the image file.
    file = request.files['image']
    file_bytes = file.read()
    npimg = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    # Run drowsiness (sleep) inference.
    result_drowsiness = drowsiness_client.infer(img, model_id=drowsiness_model_id)
    predictions_drowsiness = result_drowsiness.get('predictions', [])

    # Check for "microsleep" or "drowsy" detections.
    sleep_detected = any(
        pred.get("class", "").lower() in ("microsleep", "drowsy")
        for pred in predictions_drowsiness if isinstance(pred, dict)
    )
    sleep_history.append(sleep_detected)
    # Trigger a sleep alert if we have 10 consecutive frames with sleep detection.
    sleep_alert = (len(sleep_history) == SLEEP_HISTORY_LENGTH and all(sleep_history))

    # Draw bounding boxes for drowsiness predictions.
    for pred in predictions_drowsiness:
        if not isinstance(pred, dict):
            continue
        cx = pred.get('x')
        cy = pred.get('y')
        w = pred.get('width')
        h = pred.get('height')
        x1 = int(cx - w / 2)
        y1 = int(cy - h / 2)
        x2 = int(cx + w / 2)
        y2 = int(cy + h / 2)
        class_name = pred.get('class', 'object')
        confidence = pred.get('confidence', 0)
        label = f"{class_name}: {confidence:.2f}"
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        cv2.putText(img, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, (0, 255, 0), 2)

    # Run stress inference.
    result_stress = stress_client.infer(img, model_id=stress_model_id)
    stress_predictions_raw = result_stress.get('predictions', {})

    # Convert the stress predictions to a list if necessary.
    if isinstance(stress_predictions_raw, dict):
        stress_predictions = []
        for label, pred in stress_predictions_raw.items():
            pred['class'] = label
            stress_predictions.append(pred)
    else:
        stress_predictions = stress_predictions_raw

    # Determine if stress is detected in this frame.
    # We consider stress detected if there's any prediction labeled "stress" with confidence >= MINIMUM_STRESS_CONFIDENCE.
    stress_detected = any(
        pred.get("class", "").lower() == "stress" and pred.get("confidence", 0) >= MINIMUM_STRESS_CONFIDENCE
        for pred in stress_predictions if isinstance(pred, dict)
    )
    stress_history.append(stress_detected)
    # Trigger a stress alert if we have 8 consecutive frames with stress detected.
    stress_alert = (len(stress_history) == STRESS_CONSECUTIVE_LIMIT and all(stress_history))

    # Encode the image (with annotations) to base64.
    success, encoded_image = cv2.imencode('.jpg', img)
    if not success:
        return jsonify({"error": "Could not encode image"}), 500

    b64_image = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
    
    # Return the annotated image, predictions, and alert flags.
    return jsonify({
        "image": b64_image,
        "drowsiness_predictions": predictions_drowsiness,
        "stress_predictions": stress_predictions,
        "alerts": {
            "sleep": sleep_alert,
            "stress": stress_alert
        }
    })
