# Controlled generation example

POST this payload to `/api/generate/module` to run the staged generation flow.

```powershell
$body = Get-Content -Raw -Path "examples/generation/request.json"
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/generate/module" -ContentType "application/json" -Body $body
```

Outputs (in `workspaces/<buildId>/reports/`):
- `generation-input.json`
- `generated-manifest.json`
- `generation-report.json`
- `security-report.json`
- `integration-report.json`
- `dependency-graph.json`
