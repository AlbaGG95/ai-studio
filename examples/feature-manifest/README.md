# Feature Manifest examples

These payloads are meant to be posted to `/validate`.

PowerShell (API running on 4000):
```powershell
$body = Get-Content -Raw -Path "examples/feature-manifest/ok/request.json"
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/validate" -ContentType "application/json" -Body $body
```

Cases:
- `ok/request.json`: 2 manifests with satisfied provides/consumes + allowed writes.
- `fail-deps/request.json`: consumes missing dependency (blocks on graph).
- `fail-security/request.json`: uses forbidden API (blocks on security scan).
