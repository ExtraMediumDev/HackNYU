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
STRESS_HISTORY_LENGTH = 10    # 10 consecutive frames for stress alert

# Define additional thresholds (for example, for stress confidence)
STRESS_CONFIDENCE_THRESHOLD = 0.9  # adjust based on your model's performance

# Global deques to store the last N detections for sleep and stress.
sleep_history = deque(maxlen=SLEEP_HISTORY_LENGTH)
stress_history = deque(maxlen=STRESS_HISTORY_LENGTH)

@yolo_bp.route('/predict', methods=['POST'])
def predict():
    # Verify that an image is provided
    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400

    # Read and decode the image file
    file = request.files['image']
    file_bytes = file.read()
    npimg = np.frombuffer(file_bytes, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    # Run drowsiness (sleep) inference.
    result_drowsiness = drowsiness_client.infer(img, model_id=drowsiness_model_id)
    predictions_drowsiness = result_drowsiness.get('predictions', [])

    sleep_detected = any(
        pred.get("class", "").lower() == "microsleep"
        for pred in predictions_drowsiness if isinstance(pred, dict)
    )
    sleep_history.append(sleep_detected)
    
    # Trigger an alert if we have 10 consecutive frames with "microsleep" detected.
    sleep_alert = (len(sleep_history) == SLEEP_HISTORY_LENGTH and all(sleep_history))

    # Draw bounding boxes for drowsiness predictions
    for pred in predictions_drowsiness:
        # Ensure pred is a dictionary before drawing
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

    # Convert to a list if necessary.
    if isinstance(stress_predictions_raw, dict):
        stress_predictions = []
        for label, pred in stress_predictions_raw.items():
            # Add the label into the prediction dictionary if needed.
            pred['class'] = label
            stress_predictions.append(pred)
    else:
        stress_predictions = stress_predictions_raw

    # (Optional) Uncomment and adjust the following if you wish to enable stress alerts.
    # stress_detected = any(
    #     (pred.get("confidence", 0) if isinstance(pred, dict) else 0) >= STRESS_CONFIDENCE_THRESHOLD
    #     for pred in stress_predictions
    # )
    # stress_history.append(stress_detected)
    # stress_alert = (len(stress_history) == STRESS_HISTORY_LENGTH and all(stress_history))
    
    # For now, we'll keep stress_alert disabled:
    stress_alert = False

    # Encode the image (with annotations) to base64 to return in JSON.
    success, encoded_image = cv2.imencode('.jpg', img)
    if not success:
        return jsonify({"error": "Could not encode image"}), 500

    b64_image = base64.b64encode(encoded_image.tobytes()).decode('utf-8')
    
    # Return the annotated image, predictions, and alert flags in the response.
    return jsonify({
        "image": b64_image,
        "drowsiness_predictions": predictions_drowsiness,
        "stress_predictions": stress_predictions,
        "alerts": {
            "sleep": sleep_alert,
            "stress": stress_alert
        }
    })
