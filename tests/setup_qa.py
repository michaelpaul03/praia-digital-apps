"""Download the optional test-only axe engine with pinned integrity. No runtime dependencies."""
from pathlib import Path
from urllib.request import urlopen
import hashlib
import os
import tempfile
URL='https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js'
SHA256='880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb'
p=Path(os.environ.get('AXE_PATH',str(Path(tempfile.gettempdir())/'praia-axe-4.10.3.min.js')))
raw=p.read_bytes() if p.exists() else urlopen(URL,timeout=30).read()
if hashlib.sha256(raw).hexdigest()!=SHA256:raise SystemExit('Axe integrity verification failed.')
p.write_bytes(raw)
print(p)
