import subprocess

result = subprocess.run(
    ["git", "-C", "D:/MySoftware/photo-manager", "cat-file", "-p", "d068c300:frontend/src/components/modals/CaptionModal.jsx"],
    capture_output=True, timeout=10
)
data = result.stdout
nulls = data.count(b'\x00')
print("Extracted " + str(len(data)) + " bytes, " + str(nulls) + " nulls")

dest = r"D:\MySoftware\photo-manager\frontend\src\components\modals\CaptionModal.jsx"
with open(dest, 'wb') as f:
    f.write(data)
print("Written to " + dest)

with open(dest, 'rb') as f:
    verify = f.read()
print("Verified: " + str(verify.count(b'\x00')) + " nulls, " + str(len(verify)) + " bytes")
