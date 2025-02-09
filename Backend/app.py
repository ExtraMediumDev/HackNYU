from flask import Flask, send_from_directory, request, render_template, redirect, url_for, jsonify
from api.yolo import yolo_bp
from api.traffic import traffic_bp
from test import Audiobook
import os
from flask_cors import CORS

app = Flask(__name__, static_folder='../Frontend', static_url_path='')
CORS(app)
UPLOAD_FOLDER = "/Users/sriramnatarajan/Documents/newHack/EvenMoreFunProject/Backend/PDFS"
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# YOLO prediction blueprint registered at the '/api' prefix, but we can def change this later
app.register_blueprint(yolo_bp, url_prefix='/api')
app.register_blueprint(traffic_bp, url_prefix='/api')

@app.route('/')
def index():
    # Serving index.html and we're trying to show proof of concept
    return send_from_directory(app.static_folder, 'login.html')

@app.route('/home')
def home():
    return send_from_directory(app.static_folder, 'home.html')

@app.route('/audiobook')
def audiobook():
    return send_from_directory(app.static_folder, 'text2speech.html') 

@app.route('/api/generate-questions', methods=['POST'])
def generate_questions():
    data = request.json
    text = data.get('text', '')
    

    
    generator = Audiobook()
    questions = generator.question_generator(text)

    return jsonify({"questions": questions})

@app.route('/api/mysemantic-score', methods=['POST'])
def mysemantic_score():
    data = request.json
    correct_answer = data.get('correct_answer', '')
    user_answer = data.get('user_answer', '')

    if not correct_answer or not user_answer:
        return jsonify({"error": "Both correct_answer and user_answer are required"}), 400

    scorer = Audiobook()  # Initialize the class instance
    score_passed = scorer.semantic_score(correct_answer, user_answer)

    print(score_passed)

    return jsonify({"match": score_passed})

@app.route('/stressed')
def stressed():
    # This will serve the 'stress.html' template
    return render_template('stress.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    # Check if the request has a file part
    if 'pdfFile' not in request.files:
        return "No file part in the request", 400

    file = request.files['pdfFile']

    # If user does not select file, browser also
    # submits an empty part without filename
    if file.filename == '':
        return "No file selected", 400

    # Optional: Validate that it's actually a PDF
    # e.g., check extension or use Python's mimetype detection
    if not file.filename.lower().endswith('.pdf'):
        return "File is not a PDF!", 400

    # Save the file to the desired folder
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(save_path)
    myAudiobook = Audiobook()
    extractedText = myAudiobook.pdf_text_extractor("/Users/sriramnatarajan/Documents/newHack/EvenMoreFunProject/Backend/PDFS/" + file.filename)

    return redirect(url_for('audiobook', text=extractedText))
    # return send_from_directory(app.static_folder, 'speechtoText.html')

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)