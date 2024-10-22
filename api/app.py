from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from paddleocr import PaddleOCR
import os
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
client = MongoClient('mongodb://localhost:27017/')
db = client['dd_interaction']  # Use your database name
collection = db['dd_collection']  # Use your collection name

import re

@app.route('/check-drugs', methods=['POST'])
def check_drugs():
    words = request.json.get('words', [])
    
    # Query MongoDB to find which drugs exist in the database and fetch required details
    drugs_in_db = list(collection.find(
        {"drug_name": {"$in": words}}, 
        {"_id": 0, "drug_name": 1, "side_effects": 1, "drug_classes": 1, "medical_condition": 1}
    ))
    
    # Prepare the response with drug details
    result = []
    for drug in drugs_in_db:
        result.append({
            "drug_name": drug.get("drug_name"),
            "side_effects": drug.get("side_effects"),
            "drug_classes": drug.get("drug_classes"),
            "medical_condition": drug.get("medical_condition")
        })
    
    return jsonify({'drugs': result})
# Email configuration
def send_otp_email(receiver_email):
    sender_email = 'roshanzameer111000@gmail.com'
    smtp_username = 'roshanzameer111000@gmail.com'
    smtp_password = 'txtlogzbmzhfgjuj'
    
    otp = random.randint(1000, 9999)
    
    subject = 'Your OTP Code'
    body = f'Your OTP code is: {otp}'
    
    message = MIMEMultipart()
    message['From'] = sender_email
    message['To'] = receiver_email
    message['Subject'] = subject
    message.attach(MIMEText(body, 'plain'))
    
    try:
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(sender_email, receiver_email, message.as_string())
            print("Email sent successfully with OTP:", otp)
            return otp
    except Exception as e:
        print(f"Error: {e}")
        return None

generated_otp = None

@app.route('/send-otp', methods=['POST'])
def send_otp():
    global generated_otp
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({'message': 'Email is required'}), 400

    try:
        generated_otp = send_otp_email(email)

        if generated_otp is not None:
            return jsonify({'message': 'OTP sent successfully'}), 200
        else:
            return jsonify({'message': 'Failed to send OTP'}), 500

    except Exception as e:
        print(f'Error sending OTP: {e}')
        return jsonify({'message': 'Failed to send OTP'}), 500

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    global generated_otp
    data = request.get_json()
    otp = data.get('otp')
    first_name = data.get('firstName')
    last_name = data.get('lastName')
    email = data.get('email')
    password = data.get('password')

    if otp or int(otp) == generated_otp:
        # Here, you would typically save user details to your database
        # For demonstration purposes, we are just returning a success message
        generated_otp = None
        return jsonify({
            'message': 'OTP verified successfully',
            'user': {
                'firstName': first_name,
                'lastName': last_name,
                'email': email,
            }
        }), 200
    else:
        return jsonify({'message': 'OTP verification failed'}), 400

# OCR configuration
ocr = PaddleOCR(use_angle_cls=True, lang='en')

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'image' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)

    result = ocr.ocr(filepath, cls=True)
    texts = [word_info[1][0] for line in result for word_info in line]
    return jsonify({"text": '\n'.join(texts)})

# Handle CORS preflight requests explicitly
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    app.run(debug=True, port=5001)
