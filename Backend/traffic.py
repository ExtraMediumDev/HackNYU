HERE_API_KEY = "9o5W3tXQ7z1t5WCOgo7uJTWjZK7jY8H0IBYDXAu9prk"  # Replace with your actual HERE API Key

def get_traffic_from_coordinates(lat, lon, api_key):
    """
    Fetch real-time traffic flow data for a given latitude and longitude using HERE Traffic API.
    """
    # Calculate a small bounding box around the point (adjust as needed)
    bbox = f"{lon-0.0001},{lat-0.0001},{lon+0.0001},{lat+0.0001}"
    url = "https://data.traffic.hereapi.com/v7/flow"
    params = {
        "locationReferencing": "shape",
        "in": f"bbox:{bbox}",
        "apiKey": api_key
    }
    response = requests.get(url, params=params)
    return response.json()

def get_traffic_real(traffic_data): 
    all_jam_values = []
    for result in traffic_data.get("results", []):
        current_flow = result.get("currentFlow", {})
        for key, value in current_flow.items():
            if key != "subSegments" and key == "jamFactor":
                all_jam_values.append(value)
                if value > 8.0:
                    return "TRAFFIC"
    return "no traffic"

from flask import Flask, redirect, url_for, render_template


app = Flask(__name__)

@app.route("/")
def home():
    return render_template()

@app.route("/login", methods=["POST", "GET"])
def login() :
    return render_template()

@app.route("/<user>")
def user(usr) :
    return f"<h1>{user}</h1>"


@app.route('/traffic', methods=["POST", "GET"])
def traffic():
    """
    Expects URL parameters: lat and lon
    Example: /traffic?lat=40.660707&lon=-73.852257
    """
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid or missing latitude/longitude parameters."}), 400

    traffic_data = get_traffic_from_coordinates(lat, lon, HERE_API_KEY)
    has_traffic = get_traffic_real(traffic_data)
    return jsonify({
        "status": has_traffic,
    })

if __name__ == '__main__':
    app.run(debug=True)
