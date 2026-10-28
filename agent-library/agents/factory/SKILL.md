---
name: factory
description: Start the factory workflow only when explicitly invoked as /factory in Claude Code or $factory in Codex with a feature request, approve command, or rework command.
disable-model-invocation: true
---

# Factory command

Read [AGENT.md](AGENT.md) beside this file and follow it as the workflow entrypoint. Pass the user's request unchanged.

This file is the host command adapter. The workflow definition, child-agent roles, and skill-selection rules live in this agent bundle. Reusable capabilities live in the separate shared skills library resolved by the workflow.

Keep the bundle together when installing this adapter so its local references remain readable.
