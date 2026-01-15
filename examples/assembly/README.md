# Assembly examples

Run the assembler using:

```powershell
pnpm assemble examples/assembly/gamespec.json
pnpm assemble examples/assembly/gamespec.fail.json
```

Expected:
- OK spec -> PASS with runtime smoke report.
- FAIL spec -> assembly-report.json indicates missing module.
