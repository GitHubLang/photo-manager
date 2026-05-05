import subprocess

result = subprocess.run(
    ["git", "-C", "D:/MySoftware/photo-manager", "log", "--oneline", "--all", "--", "frontend/src/components/modals/CaptionModal.jsx"],
    capture_output=True, timeout=10
)
print(result.stdout.decode('utf-8', errors='replace'))
