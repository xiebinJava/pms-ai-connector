# CLI-Anything test matrix

| Generated concern | Verification |
| --- | --- |
| command discovery | `capabilities`, `context`, `search`, `get` are read from the PMS API |
| dynamic workflow | node/component/field names come from the capability catalog |
| safe writes | preview precedes execute; execute carries context and idempotency metadata |
| output | JSON success goes to stdout; JSON failure goes to stderr and exits non-zero |
| authentication | browser PKCE flow stores only refresh credentials in the OS keyring |
| business correctness | all write rules remain in PMS backend services |
