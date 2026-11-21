"""Package the UI update for an existing deployment without secrets or database data."""
from pathlib import Path
import hashlib
import json
import zipfile

root = Path(__file__).resolve().parents[1]
backend = root / 'backend'
selected = [
    'app/Http/Middleware/AdminLocale.php',
    'app/Http/Middleware/ApiRequestContext.php',
    'app/Http/Controllers/AdminController.php',
    'app/Http/Controllers/LicenseController.php',
    'app/Services/LicenseSigner.php',
    'bootstrap/app.php', 'routes/web.php',
]
for directory in ['resources/views/admin', 'lang']:
    selected += [p.relative_to(backend).as_posix() for p in (backend / directory).rglob('*') if p.is_file()]
public = ['admin.css', 'admin.js', 'admin-sw.js', 'brand-logo.png']
public += [p.relative_to(backend / 'public').as_posix() for p in (backend / 'public/fonts').glob('*') if p.is_file()]
target = root / 'artifacts/Proforma-Backend-UI-Update-2.0.3.zip'
manifest = []
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for rel in selected:
        data = (backend / rel).read_bytes()
        name = 'proforma-app/' + rel
        archive.writestr(name, data)
        manifest.append({'path': name, 'sha256': hashlib.sha256(data).hexdigest()})
    for rel in public:
        data = (backend / 'public' / rel).read_bytes()
        for prefix in ['public_html/', 'proforma-app/public/']:
            name = prefix + rel
            archive.writestr(name, data)
            manifest.append({'path': name, 'sha256': hashlib.sha256(data).hexdigest()})
    archive.writestr('START-HERE.md', (root / 'docs/LAYOUT-LANGUAGE-2.0.3.md').read_bytes())
    archive.writestr('manifest.json', json.dumps(manifest, indent=2))
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    for record in manifest:
        name = record['path']
        assert not any(part in {'.env', 'vendor', 'storage'} for part in Path(name).parts)
        assert Path(name).suffix not in {'.sql', '.pem', '.key', '.sqlite'}
        assert hashlib.sha256(archive.read(name)).hexdigest() == record['sha256']
print(f'Verified {len(manifest)} update files: {target}')
