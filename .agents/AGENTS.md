# Rules

- Always stage and commit code changes directly to the local repository without asking for user permission first. Do not push changes until requested.
- When working on multiple issues or tasks, always create separate branches and pull requests per issue or distinct topic. Never combine multiple tickets into a single large pull request unless explicitly requested.
- Never prompt or ask user confirmation to create, update, or close issues on the issue tracker. Proceed directly.
- Whenever asked to implement a feature or fix a bug, always follow the 7-step engineering method in order unless explicitly told to skip a step:
  1. `grill-with-docs` (`/Users/mick/.agents/skills/grill-with-docs/SKILL.md`) — interview one question at a time and update domain docs (`CONTEXT.md` / `docs/adr/`).
  2. `to-spec` (`/Users/mick/.agents/skills/to-spec/SKILL.md`) — confirm test seams, write the Spec, and publish it to GitHub (`ready-for-agent`).
  3. `to-tickets` (`/Users/mick/.agents/skills/to-tickets/SKILL.md`) — draft vertical-slice tickets, confirm breakdown with the user, and publish to GitHub (`ready-for-agent`).
  4. `implement-spec` (`/Users/mick/.agents/skills/implement-spec/SKILL.md`) — implement using Red-Green `tdd`.
  5. `code-review` Pass 1 (`/Users/mick/.agents/skills/code-review/SKILL.md`) — run parallel Standards + Spec review subagents and fix all critical/spec findings.
  6. `code-review` Pass 2 (`/Users/mick/.agents/skills/code-review/SKILL.md`) — run a second parallel Standards + Spec review scan and fix any remaining critical findings.
  7. Open a Pull Request (one PR per ticket/issue) and share the link with the user.

