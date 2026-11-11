# False success in the merge gate

Run 42959473763 evaluated PR 1326 from main `bcbb2df3`. The fleet-merge-gate App token was minted. The gate then read GraphQL `headRepository` five times, logged that the head repository was unknown, and exited 0. It did not merge.

PR 1340 changed the token and left both the field and the exit in place. An empty value took the path written for a known foreign repository. A green workflow is the wrong result for that read.

Treat a missing value as unknown. After the retries, exit 1 and name the read that failed. Read REST `head.repo` on the pulls API. That is the field a pull-request permission returns. Do not copy another credential to make the GraphQL field appear. A known foreign head still exits 0 and does not merge.

The same gate also counted every non-stale check run. On PR 1325, head `cc4596fab7fefa5530a036097cb94afd5429e272` had a cancelled `PR checks` run and a later success of that same workflow on that same commit. The cancelled predecessor made `red=1`.

Keep the latest attempt of one identity: the app, the workflow path, and the job name. Order attempts by the workflow start time, the attempt number, the workflow run id, and then the check run id. Do not collapse two workflows that share a job name. Do not drop a cancelled run that has no later attempt. Do not prefer an older success over a newer failure or a newer pending run. Do not mix commits. A missing identity or a failed API read exits 1.

A job named `merge` is not the gate by itself. Exclude this run when its URL and app match. Exclude an older run only when its workflow path is `.github/workflows/merge-when-green.yml`. A missing path or app stays in the decision and fails closed.

The commit-status API returns an array. Completeness is the `Link` header's `rel=next` chain. Fetch every next URL. A full page of 100 with no next link is complete. A next link that is not fetched, a repeated link, a link outside this commit, a non-2xx response, or a page body that is not an array exits 1. Do not treat the first 100 rows as the whole list.

## Bootstrap

`pull_request_target` runs the workflow file from the default branch. The header of `.github/workflows/merge-when-green.yml` records that. PR 1341 does not install its own gate. Adding `ready-to-merge` runs the gate that is already on main.

The small safe step is a human merge of this pull request from the GitHub UI after the pull_request checks are green. That puts this file on the default branch. This note is evidence, not approval to merge. Do not dispatch the gate, mint the app token, or squash-merge it from the agent. Live REST `head.repo` visibility for that app token is still unproven: if the field is empty, the job exits 1.
