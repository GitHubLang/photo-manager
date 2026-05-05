import subprocess
import socket

# Check if port 8000 is listening
result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
lines = result.stdout.split('\n')
for line in lines:
    if ':8000' in line and 'LISTENING' in line:
        print('Port 8000:', line)

# Try connecting to the server
try:
    sock = socket.create_connection(('172.30.240.1', 8000), timeout=3)
    sock.close()
    print('Server is reachable on 172.30.240.1:8000')
except Exception as e:
    print(f'Cannot connect: {e}')

# Try localhost
try:
    sock = socket.create_connection(('127.0.0.1', 8000), timeout=3)
    sock.close()
    print('Server is reachable on 127.0.0.1:8000')
except Exception as e:
    print(f'Cannot connect to localhost: {e}')
