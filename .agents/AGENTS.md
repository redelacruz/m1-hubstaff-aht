# Agent Project Guidelines

## Frontend Build & Deployment Workflow
- The frontend is built into a static Vinxi production bundle (`npm run build`) served inside the `hubstaff_frontend` Docker container (`npm run start`).
- Modifying files in `frontend/src/` will NOT automatically update the running production bundle.
- **Mandatory Workflow**: After making any changes to frontend files (`frontend/src/`), ALWAYS run:
  ```bash
  docker compose build --no-cache frontend && docker compose up -d frontend
  ```
  to force a complete re-compilation of the Vinxi production bundle and restart the container so changes take effect live.

## Batching Changes to Save on Build Time
When the user specifies multiple changes should be batched together, create one commit per change in the batch. After all changes have been committed, run the build command **once** at the end to compile all changes.