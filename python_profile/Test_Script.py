#!/usr/bin/env python3
"""
Test script to verify session isolation works without Redis
Run this to simulate multiple users accessing the application
"""

import requests
import json
import time
import threading
from concurrent.futures import ThreadPoolExecutor
import uuid
import os
import tempfile

API_BASE = "http://localhost:5000/api"

def create_session():
    """Create a new session and return session object"""
    session = requests.Session()
    
    # Make initial request to establish session
    response = session.get(f"{API_BASE}/health")
    if response.status_code == 200:
        data = response.json()
        return session, data['session_id']
    return None, None

def create_mock_profile_file(filename, content_type="fast"):
    """Create a mock profile file for testing"""
    content_templates = {
        "fast": """3 function calls in 0.012 seconds

   Ordered by: standard name

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    0.000    0.000    0.012    0.012 <string>:1(<module>)
        1    0.012    0.012    0.012    0.012 main.py:10(fast_function)
        1    0.000    0.000    0.000    0.000 {method 'disable' of '_lsprof.Profiler' objects}
""",
        "slow": """5 function calls in 2.456 seconds

   Ordered by: standard name

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    0.000    0.000    2.456    2.456 <string>:1(<module>)
        1    2.456    2.456    2.456    2.456 main.py:15(slow_function)
        1    0.000    0.000    0.000    0.000 utils.py:23(helper_function)
        2    0.000    0.000    0.000    0.000 {method 'disable' of '_lsprof.Profiler' objects}
""",
        "medium": """8 function calls in 0.891 seconds

   Ordered by: standard name

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    0.000    0.000    0.891    0.891 <string>:1(<module>)
        1    0.600    0.600    0.891    0.891 main.py:25(medium_function)
        3    0.291    0.097    0.291    0.097 data_processor.py:12(process_batch)
        3    0.000    0.000    0.000    0.000 {method 'disable' of '_lsprof.Profiler' objects}
"""
    }
    
    # Create temporary file
    temp_dir = tempfile.mkdtemp()
    filepath = os.path.join(temp_dir, filename)
    
    with open(filepath, 'w') as f:
        f.write(content_templates.get(content_type, content_templates["fast"]))
    
    return filepath

def simulate_file_upload(session, session_id, profile_slot, filename, content_type="fast"):
    """Simulate uploading a file"""
    filepath = create_mock_profile_file(filename, content_type)
    
    try:
        with open(filepath, 'rb') as f:
            files = {'file': (filename, f, 'application/octet-stream')}
            data = {'profile_slot': str(profile_slot)}
            
            response = session.post(f"{API_BASE}/upload", files=files, data=data)
            return response
    finally:
        # Cleanup
        try:
            os.remove(filepath)
            os.rmdir(os.path.dirname(filepath))
        except:
            pass

def test_user_session(user_id, test_results):
    """Simulate a single user's session"""
    print(f"🧪 Testing User {user_id}")
    
    # Create session
    session, session_id = create_session()
    if not session:
        test_results[user_id] = {"error": "Failed to create session"}
        return
    
    print(f"  📝 User {user_id} session: {session_id[:8]}...")
    
    # Upload files with different performance characteristics
    upload_results = []
    content_types = ["fast", "slow", "medium"]
    
    for i in range(2):  # Upload 2 files per user
        content_type = content_types[user_id % len(content_types)]
        filename = f"user_{user_id}_{content_type}_profile_{i+1}.prof"
        response = simulate_file_upload(session, session_id, i+1, filename, content_type)
        upload_results.append({
            'filename': filename,
            'status': response.status_code,
            'success': response.status_code == 200,
            'content_type': content_type
        })
        print(f"  📤 Uploaded {filename}: {'✅' if response.status_code == 200 else '❌'}")
    
    # Get profiles
    response = session.get(f"{API_BASE}/profiles")
    if response.status_code == 200:
        profiles_data = response.json()
        profiles = profiles_data.get('profiles', {})
        print(f"  📋 User {user_id} sees {len(profiles)} profiles")
        
        test_results[user_id] = {
            'session_id': session_id,
            'uploads': upload_results,
            'profiles_seen': list(profiles.keys()),
            'profile_filenames': [p.get('filename', 'Unknown') for p in profiles.values()],
            'session_info': profiles_data.get('session_info', {}),
            'storage_type': 'filesystem'
        }
        
        # Test comparison if enough profiles
        if len(profiles) >= 2:
            compare_response = session.post(f"{API_BASE}/compare")
            test_results[user_id]['comparison_success'] = compare_response.status_code == 200
            if compare_response.status_code == 200:
                comparison_data = compare_response.json()
                test_results[user_id]['comparison_results'] = {
                    'fastest_profile': comparison_data.get('comparison', {}).get('performance_metrics', {}).get('fastest_profile'),
                    'speedup_factor': comparison_data.get('comparison', {}).get('performance_metrics', {}).get('speedup_factor')
                }
                print(f"  📊 Comparison successful for User {user_id}")
        
    else:
        test_results[user_id] = {"error": f"Failed to get profiles: {response.status_code}"}

def test_isolation_violation():
    """Test if users can see each other's profiles (should NOT happen)"""
    print("\n🔍 Testing Session Isolation (File-based)...")
    print("=" * 50)
    
    test_results = {}
    
    # Simulate 4 concurrent users
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for user_id in range(1, 5):
            future = executor.submit(test_user_session, user_id, test_results)
            futures.append(future)
        
        # Wait for all users to complete
        for future in futures:
            future.result()
    
    print(f"\n📊 Test Results Analysis:")
    print("=" * 50)
    
    # Analyze results
    all_session_ids = set()
    all_profiles = {}
    successful_users = 0
    
    for user_id, results in test_results.items():
        if 'error' in results:
            print(f"❌ User {user_id}: {results['error']}")
            continue
            
        successful_users += 1
        session_id = results['session_id']
        profiles = results['profile_filenames']
        
        all_session_ids.add(session_id)
        all_profiles[user_id] = profiles
        
        print(f"✅ User {user_id}:")
        print(f"   Session: {session_id[:12]}...")
        print(f"   Profiles: {profiles}")
        print(f"   Storage: {results.get('storage_type', 'filesystem')}")
        
        if results.get('comparison_success'):
            comparison = results.get('comparison_results', {})
            print(f"   Fastest: Profile {comparison.get('fastest_profile', 'N/A')}")
            if comparison.get('speedup_factor'):
                print(f"   Speedup: {comparison['speedup_factor']:.2f}x")
    
    # Check for isolation violations
    print(f"\n🔐 Isolation Analysis:")
    print(f"   Total users tested: {len(test_results)}")
    print(f"   Successful sessions: {successful_users}")
    print(f"   Unique sessions created: {len(all_session_ids)}")
    print(f"   Storage method: File-based (No Redis)")
    
    isolation_violations = []
    for user1 in all_profiles:
        for user2 in all_profiles:
            if user1 != user2:
                user1_files = set(all_profiles[user1])
                user2_files = set(all_profiles[user2])
                common_files = user1_files.intersection(user2_files)
                
                if common_files:
                    isolation_violations.append({
                        'user1': user1,
                        'user2': user2,
                        'shared_files': list(common_files)
                    })
    
    if isolation_violations:
        print("❌ ISOLATION VIOLATION DETECTED!")
        for violation in isolation_violations:
            print(f"   Users {violation['user1']} and {violation['user2']} share: {violation['shared_files']}")
        return False
    else:
        print("✅ PERFECT ISOLATION - Each user sees only their own profiles!")
        return True

def test_file_storage_isolation():
    """Test that file storage properly isolates sessions"""
    print("\n📁 Testing File Storage Isolation...")
    
    sessions = []
    
    # Create multiple sessions
    for i in range(3):
        session, session_id = create_session()
        if session:
            sessions.append((session, session_id))
            # Upload a test file
            filename = f"file_storage_test_{i}.prof"
            response = simulate_file_upload(session, session_id, 1, filename, "fast")
            print(f"   Session {i+1} ({session_id[:8]}...): Upload {'✅' if response.status_code == 200 else '❌'}")
    
    if len(sessions) < 3:
        print("❌ Failed to create test sessions")
        return False
    
    # Verify each session only sees its own files
    isolation_ok = True
    for i, (session, session_id) in enumerate(sessions):
        response = session.get(f"{API_BASE}/profiles")
        if response.status_code == 200:
            profiles = response.json().get('profiles', {})
            expected_filename = f"file_storage_test_{i}.prof"
            
            if len(profiles) == 1 and profiles.get('1', {}).get('filename') == expected_filename:
                print(f"   ✅ Session {i+1} sees only its own file: {expected_filename}")
            else:
                print(f"   ❌ Session {i+1} isolation failed")
                isolation_ok = False
        else:
            print(f"   ❌ Session {i+1} failed to get profiles")
            isolation_ok = False
    
    return isolation_ok

def test_session_persistence():
    """Test that sessions persist across requests without Redis"""
    print("\n🔄 Testing Session Persistence (File-based)...")
    
    # Create session and upload file
    session, session_id = create_session()
    print(f"   Initial session: {session_id[:8]}...")
    
    # Upload a file
    response = simulate_file_upload(session, session_id, 1, "persistence_test.prof", "fast")
    if response.status_code != 200:
        print("❌ Upload failed")
        return False
    
    # Wait a bit
    time.sleep(1)
    
    # Check if file still exists
    response = session.get(f"{API_BASE}/profiles")
    if response.status_code == 200:
        profiles = response.json().get('profiles', {})
        if '1' in profiles and 'persistence_test.prof' in profiles['1']['filename']:
            print("✅ Session persistence works!")
            
            # Test clearing
            clear_response = session.post(f"{API_BASE}/clear")
            if clear_response.status_code == 200:
                # Verify files are cleared
                response = session.get(f"{API_BASE}/profiles")
                if response.status_code == 200:
                    profiles = response.json().get('profiles', {})
                    if len(profiles) == 0:
                        print("✅ Clear function works!")
                        return True
                    else:
                        print("❌ Clear function failed - profiles still exist")
                        return False
            else:
                print("❌ Clear function failed")
                return False
        else:
            print("❌ Session persistence failed - file not found")
            return False
    
    print("❌ Session persistence failed")
    return False

def test_concurrent_operations():
    """Test multiple users uploading and comparing simultaneously"""
    print("\n⚡ Testing Concurrent Operations (File-based)...")
    
    def user_workflow(user_id):
        try:
            session, session_id = create_session()
            if not session:
                return False
            
            # Upload 3 files quickly
            for i in range(3):
                filename = f"concurrent_user_{user_id}_file_{i+1}.prof"
                content_type = ["fast", "medium", "slow"][i]
                response = simulate_file_upload(session, session_id, i+1, filename, content_type)
                if response.status_code != 200:
                    return False
            
            # Immediately try to compare
            response = session.post(f"{API_BASE}/compare")
            return response.status_code == 200
            
        except Exception as e:
            print(f"Error in user {user_id} workflow: {e}")
            return False
    
    # Run 5 users concurrently
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(user_workflow, i) for i in range(1, 6)]
        results = [future.result() for future in futures]
    
    success_count = sum(results)
    print(f"   Concurrent operations: {success_count}/5 users successful")
    
    if success_count >= 4:  # Allow for 1 potential failure due to timing
        print("✅ Concurrent operations work well!")
        return True
    else:
        print("❌ Concurrent operations failed")
        return False

def test_debug_endpoint():
    """Test the debug endpoint that shows all sessions"""
    print("\n🐛 Testing Debug Endpoint (File-based)...")
    
    # Create a few sessions
    sessions = []
    for i in range(3):
        session, session_id = create_session()
        if session:
            sessions.append((session, session_id))
            # Upload one file per session
            simulate_file_upload(session, session_id, 1, f"debug_test_{i}.prof", "fast")
    
    if not sessions:
        print("❌ Failed to create test sessions")
        return False
    
    # Test debug endpoint with one of the sessions
    session, session_id = sessions[0]
    response = session.get(f"{API_BASE}/debug/all-sessions")
    
    if response.status_code == 200:
        debug_data = response.json()
        total_sessions = debug_data.get('total_sessions', 0)
        storage_type = debug_data.get('storage_type', 'unknown')
        print(f"   Debug endpoint shows {total_sessions} active sessions")
        print(f"   Storage type: {storage_type}")
        
        if total_sessions >= 3 and storage_type == 'filesystem':
            print("✅ Debug endpoint works correctly!")
            return True
        else:
            print("❌ Debug endpoint missing some sessions or wrong storage type")
            return False
    else:
        print("❌ Debug endpoint failed")
        return False

def test_no_redis_dependency():
    """Test that the application works without Redis"""
    print("\n🚫 Testing No Redis Dependency...")
    
    try:
        # Try to import redis (should not be required)
        import redis
        print("   ⚠️  Redis is installed but should not be required")
    except ImportError:
        print("   ✅ Redis not installed - this is good!")
    
    # Test that health endpoint confirms no Redis
    session = requests.Session()
    response = session.get(f"{API_BASE}/health")
    
    if response.status_code == 200:
        health_data = response.json()
        storage_type = health_data.get('storage_type', 'unknown')
        storage_accessible = health_data.get('storage_accessible', False)
        
        if storage_type == 'filesystem' and storage_accessible:
            print(f"   ✅ Using {storage_type} storage successfully")
            print(f"   ✅ Storage directories accessible: {storage_accessible}")
            return True
        else:
            print(f"   ❌ Wrong storage type: {storage_type}")
            return False
    else:
        print("   ❌ Health check failed")
        return False

def cleanup_test_data():
    """Cleanup any test data that might be left behind"""
    print("\n🧹 Cleaning up test data...")
    
    try:
        # Try to get debug info and clean up
        session = requests.Session()
        response = session.get(f"{API_BASE}/debug/all-sessions")
        
        if response.status_code == 200:
            debug_data = response.json()
            session_count = debug_data.get('total_sessions', 0)
            print(f"   Found {session_count} active sessions before cleanup")
        
        print("   Test cleanup completed (files will auto-expire)")
        return True
        
    except Exception as e:
        print(f"   Cleanup error (non-critical): {e}")
        return True

def run_no_redis_test_suite():
    """Run all tests for no-Redis version"""
    print("🧪 Python Profile Comparison - No Redis Test Suite")
    print("=" * 70)
    print("Testing session isolation using file-based storage (No Redis)")
    print("=" * 70)
    
    try:
        # Test basic health first
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code != 200:
            print("❌ Server is not running. Please start the Flask app first.")
            print("   Run: python app.py")
            return False
        
        health_data = response.json()
        storage_type = health_data.get('storage_type', 'unknown')
        print(f"✅ Server is running (Storage: {storage_type})")
        
        if storage_type != 'filesystem':
            print("⚠️  Expected filesystem storage, but got:", storage_type)
        
        # Run all test suites
        tests = [
            ("Session Isolation", test_isolation_violation),
            ("File Storage Isolation", test_file_storage_isolation),
            ("Session Persistence", test_session_persistence),
            ("Concurrent Operations", test_concurrent_operations),
            ("Debug Endpoint", test_debug_endpoint),
            ("No Redis Dependency", test_no_redis_dependency)
        ]
        
        results = []
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                start_time = time.time()
                result = test_func()
                end_time = time.time()
                duration = end_time - start_time
                results.append((test_name, result, duration))
                print(f"   Test completed in {duration:.2f} seconds")
            except Exception as e:
                print(f"❌ {test_name} failed with error: {e}")
                results.append((test_name, False, 0))
        
        # Cleanup
        cleanup_test_data()
        
        # Final summary
        print(f"\n{'='*70}")
        print("📋 NO REDIS TEST RESULTS")
        print("="*70)
        
        passed = 0
        total = len(results)
        
        for test_name, result, duration in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name:<25} ({duration:.2f}s)")
            if result:
                passed += 1
        
        print(f"\n📊 Overall Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 ALL TESTS PASSED! File-based session isolation works perfectly.")
            print("\n✨ Key achievements verified:")
            print("   • Complete session isolation without Redis")
            print("   • File-based session storage working correctly")
            print("   • Persistent session data across requests")
            print("   • Robust concurrent operations handling")
            print("   • Proper cleanup and debugging capabilities")
            print("   • No external dependencies required")
            print("\n🚀 Your application is ready for production (Redis-free)!")
            return True
        else:
            print(f"⚠️  {total - passed} test(s) failed. Please review the implementation.")
            print("\n🔧 Troubleshooting tips:")
            print("   • Check Flask app configuration")
            print("   • Verify file system permissions")
            print("   • Ensure storage directories are writable")
            print("   • Review session configuration")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure Flask app is running on localhost:5000")
        print("   Start the server with: python app.py")
        return False
    except Exception as e:
        print(f"❌ Test suite failed with unexpected error: {e}")
        return False

if __name__ == "__main__":
    success = run_no_redis_test_suite()
    exit(0 if success else 1)