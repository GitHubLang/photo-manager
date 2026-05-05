import subprocess
import sys

commits = [
    "f88e4072", "dafc1ed3", "9b465936", "6eeb1c73",
    "c105c9e9", "d068c300", "16b8cdde", "728a3431",
    "0a7dff83", "6fc3caae", "a0e15ae6"
]

for commit in commits:
    result = subprocess.run(
        ["git", "-C", "D:/MySoftware/photo-manager", "cat-file", "-p", f"{commit}:frontend/src/App.jsx"],
        capture_output=True, timeout=10
    )
    data = result.stdout
    null_count = data.count(b'\x00')
    size = len(data)
    msg_result = subprocess.run(
        ["git", "-C", "D:/MySoftware/photo-manager", "log", "--oneline", "-1", commit],
        capture_output=True, timeout=5
    )
    msg = msg_result.stdout.decode('utf-8', errors='replace').strip()
    status = "CLEAN" if null_count == 0 else f"DIRTY({null_count} nulls)"
    print(f"{status}  {commit}  {msg[:60]}")
