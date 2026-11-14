"""Validate and package the dependency-free GitHub Pages site. No transpilation required."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
import argparse,hashlib,json,re,shutil,subprocess
ROOT=Path(__file__).resolve().parents[1]
APPS=['property-planner','calendar-auditor','stay-splitter','trip-planner','local-guide']
class Assets(HTMLParser):
 def __init__(self):super().__init__();self.paths=[]
 def handle_starttag(self,tag,attrs):
  d=dict(attrs)
  if tag=='script' and d.get('src'):self.paths.append(d['src'])
  if tag=='link' and d.get('href'):self.paths.append(d['href'])
def build(out):
 files=[ROOT/'index.html',ROOT/'LICENSE',ROOT/'.nojekyll']+[ROOT/a/'index.html' for a in APPS]
 files+=list((ROOT/'assets').rglob('*'))+[ROOT/a/'assets/app.js' for a in APPS]
 files=sorted(set(f for f in files if f.is_file()))
 contents={f:f.read_bytes() for f in files}
 license_bytes=contents[ROOT/'LICENSE']
 assert hashlib.sha1(b'blob '+str(len(license_bytes)).encode()+b'\0'+license_bytes).hexdigest()=='0b1016cff1f769b91a8dae7a10abab41b955bee6','Original MIT license changed'
 assert not (ROOT/'CNAME').exists(),'No custom domain is authorized'
 for f in files:
  if f.suffix=='.html':
   text=contents[f].decode('utf-8');assert '<html lang="en">' in text and '<meta name="viewport"' in text
   parser=Assets();parser.feed(text)
   for src in parser.paths:
    assert not urlparse(src).scheme,'Runtime assets must be local'
    assert (f.parent/unquote(src)).resolve().is_file(),f'Missing asset {src} in {f}'
  if f.suffix=='.js':
   for src in re.findall(r"(?:from\s*|import\s*)['\"]([^'\"]+)['\"]",contents[f].decode('utf-8')):
    if src.startswith('.'):assert (f.parent/src).resolve().is_file(),f'Missing module {src} in {f}'
 script="import {SourceTextModule} from 'node:vm';import{readFileSync}from'node:fs';for(const [f,code]of Object.entries(JSON.parse(readFileSync(0,'utf8'))))new SourceTextModule(code,{identifier:f});"
 subprocess.run(['node','--experimental-vm-modules','--input-type=module','-e',script],input=json.dumps({str(f):contents[f].decode('utf-8') for f in files if f.suffix=='.js'}),text=True,check=True,capture_output=True)
 out=out.resolve();assert out!=ROOT and ROOT not in out.parents or out.name=='dist','Use a separate output folder or dist'
 out.mkdir(parents=True,exist_ok=True)
 for f in files:
  dest=out/f.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(contents[f])
 manifest={str(f.relative_to(ROOT)):hashlib.sha256(contents[f]).hexdigest() for f in files}
 (out/'build-manifest.json').write_text(json.dumps(manifest,indent=2))
 print(f'PASS: {len(files)} production files; six entry points; local assets/modules; unchanged MIT license; no CNAME. Output: {out}')
 return manifest
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT/'dist');args=parser.parse_args();build(args.output)
