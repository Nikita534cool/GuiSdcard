from flask import Flask, render_template, jsonify, request, send_from_directory
import os
import platform

app = Flask(__name__)

# Determine the base directory
if platform.system() == "Windows":
    BASE_DIR = "C:\\sdcard"
else:
    BASE_DIR = "/sdcard"

# Ensure the baseline directory exists
INITIAL_DIR = os.path.join(BASE_DIR, "gui")
os.makedirs(INITIAL_DIR, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

import shutil

@app.route('/api/list')
def list_files():
    path = request.args.get('path', INITIAL_DIR)
    
    # Normalize path and handle permissions/existence
    path = os.path.abspath(path)
    
    try:
        if not os.path.exists(path):
            return jsonify({"error": "Path does not exist"}), 404
            
        items = []
        # Get parent directory
        parent = os.path.dirname(path) if path != os.path.dirname(path) else None
        
        for entry in os.scandir(path):
            try:
                stats = entry.stat()
                items.append({
                    "name": entry.name,
                    "is_dir": entry.is_dir(),
                    "path": entry.path,
                    "size": stats.st_size if entry.is_file() else 0,
                    "modified": stats.st_mtime
                })
            except (PermissionError, FileNotFoundError):
                continue
        
        items.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        
        return jsonify({
            "current_path": path,
            "parent_path": parent,
            "items": items
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/upload', methods=['POST'])
def upload_file():
    target_dir = request.args.get('path')
    if not target_dir or not os.path.isdir(target_dir):
        return "Invalid target directory", 400
        
    if 'file' not in request.files:
        return "No file part", 400
        
    file = request.files['file']
    if file.filename == '':
        return "No selected file", 400
        
    filename = os.path.join(target_dir, file.filename)
    file.save(filename)
    return jsonify({"success": True, "path": filename})

@app.route('/api/copy', methods=['POST'])
def copy_operation():
    data = request.json
    src = data.get('src')
    dest_dir = data.get('dest_dir')
    
    if not src or not dest_dir:
        return "Missing source or destination", 400
        
    dest = os.path.join(dest_dir, os.path.basename(src))
    
    try:
        if os.path.isdir(src):
            shutil.copytree(src, dest)
        else:
            shutil.copy2(src, dest)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/download')
def download_file():
    path = request.args.get('path')
    if path and os.path.isfile(path):
        return send_from_directory(os.path.dirname(path), os.path.basename(path))
    return "File not found", 404

if __name__ == '__main__':
    # Run on all interfaces on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
