import requests
from flask import Blueprint, request, jsonify
from dotenv import load_dotenv
import os

load_dotenv()

HERE_API_KEY = os.getenv("HERE_API_KEY")

# Create a blueprint for traffic-related endpoints.
traffic_bp = Blueprint('traffic_bp', __name__)

def get_traffic_from_coordinates(lat, lon, api_key):
    # Create a small bounding box around the coordinate (adjust as needed)
    bbox = f"{lon-0.0025},{lat-0.0025},{lon+0.0025},{lat+0.0025}"
    url = "https://data.traffic.hereapi.com/v7/flow"  # Verify this URL with HERE documentation
    params = {
        "locationReferencing": "shape",
        "in": f"bbox:{bbox}",
        "apiKey": api_key
    }
    response = requests.get(url, params=params)
    try:
        data = response.json()
    except Exception as e:
        # Print the raw response text for debugging purposes.
        print("Error parsing HERE API response. Raw response:")
        print(response.text)
        raise e
    return data

def get_traffic_real(traffic_data):
    for result in traffic_data.get("results", []):
        current_flow = result.get("currentFlow", {})
        jam_factor = current_flow.get("jamFactor")
        if jam_factor is not None and jam_factor > 6.0:
            return "TRAFFIC"
    return "NO TRAFFIC"

@traffic_bp.route('/traffic', methods=["GET"])
def traffic_api():
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lon"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid or missing latitude/longitude parameters."}), 400

    try:
        traffic_data = get_traffic_from_coordinates(lat, lon, HERE_API_KEY)
    except requests.RequestException as e:
        return jsonify({"error": "Error fetching traffic data.", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"error": "Error parsing traffic data from HERE.", "details": str(e)}), 500

    status = get_traffic_real(traffic_data)
    return jsonify({
        "status": status,
        "data": traffic_data
    })
