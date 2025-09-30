from flask import Flask, request, jsonify, session
from flask_cors import CORS
import os
import pickle
import pstats
import cProfile
import io
import tempfile
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import json
import uuid
import hashlib
import shutil
import threading
import time

app = Flask(__name__)

# Configuration without Redis
app.config['SECRET_KEY'] = os.urandom(24)  # Random secret key
app.config['SESSION_TYPE'] = 'filesystem'  # Use filesystem instead of Redis
app.config['SESSION_FILE_DIR'] = os.path.join(os.getcwd(), 'sessions')  # Session storage directory
app.config['SESSION_PERMANENT'] = True
app.config['SESSION_USE_SIGNER'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)

# Security configurations
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False  # Set True in production with HTTPS

app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROFILES_STORAGE_DIR'] = 'profile_data'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Initialize CORS
CORS(app, supports_credentials=True, origins=['*'])

# Ensure directories exist
os.makedirs(app.config['SESSION_FILE_DIR'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROFILES_STORAGE_DIR'], exist_ok=True)

ALLOWED_EXTENSIONS = {'prof', 'pstats', 'pkl'}

# Global lock for file operations
file_lock = threading.Lock()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.before_request
def ensure_unique_session():
    """Ensure each browser/tab gets a unique session automatically"""
    if 'session_id' not in session:
        # Generate cryptographically secure session ID
        session['session_id'] = str(uuid.uuid4())
        session['created_at'] = datetime.utcnow().isoformat()
        session['browser_fingerprint'] = generate_browser_fingerprint()
        session.permanent = True
        
        # Log session creation
        print(f"New session created: {session['session_id']}")
    
    # Clean up old sessions periodically
    cleanup_expired_sessions()

def generate_browser_fingerprint():
    """Generate a simple browser fingerprint for additional uniqueness"""
    user_agent = request.headers.get('User-Agent', '')
    remote_addr = request.remote_addr or ''
    accept_lang = request.headers.get('Accept-Language', '')
    
    fingerprint_string = f"{user_agent}:{remote_addr}:{accept_lang}"
    return hashlib.md5(fingerprint_string.encode()).hexdigest()[:16]

def get_session_profile_file():
    """Get the file path for current session's profile data"""
    session_id = session.get('session_id')
    if not session_id:
        raise ValueError("No session ID found")
    return os.path.join(app.config['PROFILES_STORAGE_DIR'], f"{session_id}.json")

def cleanup_expired_sessions():
    """Clean up expired session data"""
    try:
        current_time = datetime.utcnow()
        cutoff_time = current_time - timedelta(hours=25)  # Clean up sessions older than 25 hours
        
        # Clean up profile data files
        profile_dir = app.config['PROFILES_STORAGE_DIR']
        if os.path.exists(profile_dir):
            for filename in os.listdir(profile_dir):
                if filename.endswith('.json'):
                    filepath = os.path.join(profile_dir, filename)
                    try:
                        file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                        if file_mtime < cutoff_time:
                            os.remove(filepath)
                            print(f"Cleaned up expired profile data: {filename}")
                    except:
                        pass
        
        # Clean up upload directories
        upload_dir = app.config['UPLOAD_FOLDER']
        if os.path.exists(upload_dir):
            for session_dir in os.listdir(upload_dir):
                session_path = os.path.join(upload_dir, session_dir)
                if os.path.isdir(session_path):
                    try:
                        dir_mtime = datetime.fromtimestamp(os.path.getmtime(session_path))
                        if dir_mtime < cutoff_time:
                            shutil.rmtree(session_path)
                            print(f"Cleaned up expired upload directory: {session_dir}")
                    except:
                        pass
        
        # Clean up Flask session files
        session_dir = app.config['SESSION_FILE_DIR']
        if os.path.exists(session_dir):
            for filename in os.listdir(session_dir):
                filepath = os.path.join(session_dir, filename)
                try:
                    file_mtime = datetime.fromtimestamp(os.path.getmtime(filepath))
                    if file_mtime < cutoff_time:
                        os.remove(filepath)
                        print(f"Cleaned up expired session file: {filename}")
                except:
                    pass
                    
    except Exception as e:
        print(f"Cleanup error: {e}")

def parse_profile_file(filepath):
    """Parse different types of Python profiling files"""
    try:
        stats = pstats.Stats(filepath)
        
        profile_data = {
            'total_calls': stats.total_calls,
            'total_time': stats.total_tt,
            'functions': []
        }
        
        stats.sort_stats('cumulative')
        
        for func_name, func_stats in list(stats.stats.items())[:50]:
            profile_data['functions'].append({
                'name': f"{func_name[0]}:{func_name[1]}({func_name[2]})",
                'calls': func_stats[0],
                'total_time': func_stats[2],
                'cumulative_time': func_stats[3],
                'per_call': func_stats[3] / func_stats[0] if func_stats[0] > 0 else 0
            })
        
        return profile_data
    
    except Exception as e:
        try:
            with open(filepath, 'rb') as f:
                data = pickle.load(f)
                return {
                    'total_calls': len(data) if isinstance(data, list) else 0,
                    'total_time': 0,
                    'functions': [],
                    'raw_data': str(type(data))
                }
        except:
            return {
                'error': f'Could not parse profile file: {str(e)}',
                'total_calls': 0,
                'total_time': 0,
                'functions': []
            }

@app.route('/api/session-info', methods=['GET'])
def get_session_info():
    """Return current session information for debugging/display"""
    profiles = get_user_profiles_from_storage()
    return jsonify({
        'session_id': session.get('session_id'),
        'created_at': session.get('created_at'),
        'browser_fingerprint': session.get('browser_fingerprint'),
        'profiles_count': len(profiles)
    }), 200

def get_user_profiles_from_storage():
    """Get profiles for current session from file storage"""
    try:
        with file_lock:
            profile_file = get_session_profile_file()
            if os.path.exists(profile_file):
                with open(profile_file, 'r') as f:
                    return json.load(f)
            return {}
    except Exception as e:
        print(f"Error loading profiles: {e}")
        return {}

def save_user_profiles_to_storage(profiles):
    """Save profiles for current session to file storage"""
    try:
        with file_lock:
            profile_file = get_session_profile_file()
            with open(profile_file, 'w') as f:
                json.dump(profiles, f, indent=2)
    except Exception as e:
        print(f"Error saving profiles: {e}")

@app.route('/api/upload', methods=['POST'])
def upload_profile():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    profile_slot = request.form.get('profile_slot', '1')
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        # Create session-specific upload directory
        session_id = session.get('session_id')
        session_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        os.makedirs(session_upload_dir, exist_ok=True)
        
        filename = secure_filename(file.filename)
        # Add timestamp to prevent filename conflicts
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        filepath = os.path.join(session_upload_dir, unique_filename)
        
        file.save(filepath)
        
        # Parse the profile file
        profile_data = parse_profile_file(filepath)
        
        # Load existing profiles for this session
        profiles = get_user_profiles_from_storage()
        
        # Store new profile
        profiles[profile_slot] = {
            'filename': filename,
            'unique_filename': unique_filename,
            'filepath': filepath,
            'uploaded_at': datetime.utcnow().isoformat(),
            'data': profile_data
        }
        
        # Save back to session-specific storage
        save_user_profiles_to_storage(profiles)
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': filename,
            'profile_slot': profile_slot,
            'session_id': session_id,
            'data': profile_data
        }), 200
    
    return jsonify({'error': 'Invalid file type. Please upload .prof, .pstats, or .pkl files'}), 400

@app.route('/api/profiles', methods=['GET'])
def get_profiles():
    """Get profiles for current session only"""
    profiles = get_user_profiles_from_storage()
    session_info = {
        'session_id': session.get('session_id'),
        'created_at': session.get('created_at')
    }
    
    return jsonify({
        'profiles': profiles,
        'session_info': session_info
    }), 200

@app.route('/api/compare', methods=['POST'])
def compare_profiles():
    profiles = get_user_profiles_from_storage()
    
    if len(profiles) < 2:
        return jsonify({'error': 'At least 2 profiles are required for comparison'}), 400
    
    # Comparison logic
    profile_list = list(profiles.values())
    comparison_data = {
        'session_id': session.get('session_id'),
        'profiles': [],
        'comparison': {
            'total_time_comparison': [],
            'total_calls_comparison': [],
            'common_functions': [],
            'unique_functions': {},
            'performance_metrics': {}
        }
    }
    
    # Add profile summaries
    for i, profile in enumerate(profile_list):
        comparison_data['profiles'].append({
            'filename': profile['filename'],
            'uploaded_at': profile['uploaded_at'],
            'total_calls': profile['data'].get('total_calls', 0),
            'total_time': profile['data'].get('total_time', 0),
            'function_count': len(profile['data'].get('functions', []))
        })
    
    # Performance comparison logic
    if len(profile_list) >= 2:
        times = [p['data'].get('total_time', 0) for p in profile_list]
        calls = [p['data'].get('total_calls', 0) for p in profile_list]
        
        comparison_data['comparison']['total_time_comparison'] = times
        comparison_data['comparison']['total_calls_comparison'] = calls
        
        # Function analysis
        all_functions = {}
        for i, profile in enumerate(profile_list):
            functions = profile['data'].get('functions', [])
            for func in functions:
                func_name = func['name']
                if func_name not in all_functions:
                    all_functions[func_name] = {}
                all_functions[func_name][f'profile_{i+1}'] = func
        
        # Find common and unique functions
        common_funcs = []
        unique_funcs = {f'profile_{i+1}': [] for i in range(len(profile_list))}
        
        for func_name, func_data in all_functions.items():
            if len(func_data) == len(profile_list):
                common_funcs.append({
                    'name': func_name,
                    'profiles': func_data
                })
            else:
                for profile_key in func_data:
                    unique_funcs[profile_key].append({
                        'name': func_name,
                        'data': func_data[profile_key]
                    })
        
        comparison_data['comparison']['common_functions'] = common_funcs[:20]
        comparison_data['comparison']['unique_functions'] = unique_funcs
        
        # Performance metrics
        if len(times) >= 2:
            fastest_profile = times.index(min(times)) + 1
            slowest_profile = times.index(max(times)) + 1
            performance_diff = max(times) - min(times)
            
            comparison_data['comparison']['performance_metrics'] = {
                'fastest_profile': fastest_profile,
                'slowest_profile': slowest_profile,
                'time_difference': performance_diff,
                'speedup_factor': max(times) / min(times) if min(times) > 0 else 0
            }
    
    return jsonify(comparison_data), 200

@app.route('/api/clear', methods=['POST'])
def clear_profiles():
    """Clear profiles for current session only"""
    try:
        session_id = session.get('session_id')
        
        # Get current session's profiles
        profiles = get_user_profiles_from_storage()
        
        # Delete uploaded files for this session
        for profile in profiles.values():
            filepath = profile.get('filepath')
            if filepath and os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    print(f"Deleted file: {filepath}")
                except Exception as e:
                    print(f"Error deleting file {filepath}: {e}")
        
        # Clear session directory if empty
        session_upload_dir = os.path.join(app.config['UPLOAD_FOLDER'], session_id)
        if os.path.exists(session_upload_dir):
            try:
                os.rmdir(session_upload_dir)  # Only removes if empty
                print(f"Deleted session directory: {session_upload_dir}")
            except OSError:
                pass  # Directory not empty or other error
        
        # Clear profile data file
        with file_lock:
            profile_file = get_session_profile_file()
            if os.path.exists(profile_file):
                os.remove(profile_file)
        
        return jsonify({
            'message': 'All profiles cleared for current session',
            'session_id': session_id
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'Error clearing profiles: {str(e)}'
        }), 500

@app.route('/api/debug/all-sessions', methods=['GET'])
def debug_all_sessions():
    """Debug endpoint to see all active sessions (remove in production)"""
    try:
        all_sessions = {}
        
        # Check profile data files
        profile_dir = app.config['PROFILES_STORAGE_DIR']
        if os.path.exists(profile_dir):
            for filename in os.listdir(profile_dir):
                if filename.endswith('.json'):
                    session_id = filename[:-5]  # Remove .json extension
                    filepath = os.path.join(profile_dir, filename)
                    try:
                        with open(filepath, 'r') as f:
                            profiles = json.load(f)
                            all_sessions[session_id] = {
                                'profile_count': len(profiles),
                                'profiles': list(profiles.keys()),
                                'last_modified': os.path.getmtime(filepath)
                            }
                    except:
                        pass
        
        return jsonify({
            'total_sessions': len(all_sessions),
            'sessions': all_sessions,
            'storage_type': 'filesystem'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Check if storage directories are accessible
        storage_accessible = (
            os.path.exists(app.config['SESSION_FILE_DIR']) and
            os.path.exists(app.config['PROFILES_STORAGE_DIR']) and
            os.path.exists(app.config['UPLOAD_FOLDER'])
        )
    except:
        storage_accessible = False
    
    return jsonify({
        'status': 'healthy',
        'session_id': session.get('session_id'),
        'storage_accessible': storage_accessible,
        'storage_type': 'filesystem',
        'timestamp': datetime.utcnow().isoformat(),
        'active_profiles': len(get_user_profiles_from_storage())
    }), 200

# Background cleanup task
def background_cleanup():
    """Run cleanup periodically in background"""
    while True:
        time.sleep(3600)  # Run every hour
        try:
            cleanup_expired_sessions()
        except Exception as e:
            print(f"Background cleanup error: {e}")

# Start background cleanup thread
cleanup_thread = threading.Thread(target=background_cleanup, daemon=True)
cleanup_thread.start()

if __name__ == '__main__':
    print("Starting Python Profile Comparison Server (No Redis)")
    print("=" * 60)
    print("Session isolation features:")
    print("Unique session ID per browser/tab")
    print("File-based session storage")
    print("Session-specific file storage")
    print("Complete data isolation between users")
    print("Automatic cleanup of expired sessions")
    print("Browser fingerprinting for additional security")
    print("Background cleanup tasks")
    print("=" * 60)
    print("Storage directories:")
    print(f"  Sessions: {app.config['SESSION_FILE_DIR']}")
    print(f"  Profiles: {app.config['PROFILES_STORAGE_DIR']}")
    print(f"  Uploads: {app.config['UPLOAD_FOLDER']}")
    print("=" * 60)
    print("Available endpoints:")
    print("  POST /api/upload - Upload profile file")
    print("  GET  /api/profiles - Get current session profiles")
    print("  POST /api/compare - Compare profiles")
    print("  POST /api/clear - Clear current session")
    print("  GET  /api/session-info - Get session information")
    print("  GET  /api/health - Health check")
    print("  GET  /api/debug/all-sessions - Debug all sessions")
    print("=" * 60)
    print("\nServer starting on http://localhost:5000")
    print("No Redis required! Using file-based session storage.")
    
    app.run(debug=True, host='0.0.0.0', port=5000)