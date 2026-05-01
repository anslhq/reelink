# Findings Schema Validation Notes

Status: historical adversarial review, reconciled for Reck. Earlier drafts reviewed a Reelink-era `WorkItem` rename. That material is retained only as migration context and is not the current public contract.

## Current Contract

The public Layer 0 contract for `reck_analyze` is:

```json
{
  "recording_id": "...",
  "duration_sec": 0,
  "summary": "...",
  "findings": [],
  "next_steps": []
}
```

Each finding should include `id`, `ts`, `type`, `severity`, `title`, and `confidence`, with optional richer fields only when they are actually produced and documented.

## Legacy Context

Older Reelink artifacts and docs may contain `work_items`, `reelink_analyze`, `.reelink/`, `REELINK_*`, or local source paths. Treat those as historical or compatibility-only. They are not primary public release guidance.

## Validation Focus

Before claiming completion, verify:

- `reck_analyze` returns `findings` publicly.
- Stored `.reck/` packages preserve `analysis.json`, frames, manifest, and honest missing-stream status.
- Retrieval tools read `findings` and only read `work_items` as compatibility/detail data.
- Live OpenRouter/Qwen proof is labeled not-run unless a real key and recording were used.
