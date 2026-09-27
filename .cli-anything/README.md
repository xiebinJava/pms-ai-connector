# CLI-Anything harness notes

This directory is the reviewed output of the CLI-Anything methodology for
PMS. It is intentionally documentation and test input, not a runtime
dependency. The generated harness is an HTTP API client: it discovers the
current PMS capability catalog, resolves the current workflow context, and
delegates validation, authorization, idempotency and audit to PMS.

Review gates applied to generated output:

- no database access or duplicated PMS business rules;
- no browser/GUI click automation;
- no fixed workflow node names or dynamic field names;
- no administrator token, password or secret in source or logs;
- writes use preview/context, a request ID and an idempotency key;
- JSON success is stdout and JSON failure is stderr with a non-zero exit code.

The executable produced from this harness is `pms`, installed into PATH.
