import subprocess
import sys
import os

# Change to backend directory
os.chdir(r'D:\MySoftware\photo-manager\backend')

# Start the server
proc = subprocess.Popen(
    [r'C:\Users\ADMIN\AppData\Local\Programs\Python\Python311\python.exe', 'main.py'],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    bufsize=1
)

print(f"Server started with PID: {proc.pid}")
print("Waiting for startup...")
import time
time.sleep(5)

# Check if still running
if proc.poll() is None:
    print("Server is running!")
    # Try to read first few lines of output
    proc.terminate()
    print("Server terminated for testing")
else:
    print(f"Server died with return code: {proc.returncode}")
    output, _ = proc.communicate()
    print("Output:", output.decode('utf-8', errors='replace')[:500])
