# Reck Query Algorithm Notes

Status: legacy algorithm note reconciled for Reck naming. This document describes deterministic query behavior; old Reelink names are retained only when describing historical artifacts or migration compatibility.

## Public Tool

Use `reck_query(recording_id, question)`. The query path is deterministic-first and answers from persisted `.reck/` artifacts such as `analysis.json`, `manifest.json`, `findings`, `summary`, `next_steps`, frame metadata, and stream availability. It must not call GPT/OpenAI or any other model path unless an explicit AI SDK fallback is implemented, configured, documented, and verified.

## Normative Data

`findings` is the public Layer 0 contract. If a legacy package contains `work_items`, query code may read it as compatibility/detail data, but new public examples should use `findings`.

## Compatibility

Legacy `.reelink/` packages and `reelink_query` references are migration/local-dev compatibility only. New writes and docs use `.reck/` and `reck_query`.

## Non-Claims

This document does not claim benchmark/token savings, broad framework support, live OpenRouter success, self-host fallback support, rrweb support, or bundled agentation.
