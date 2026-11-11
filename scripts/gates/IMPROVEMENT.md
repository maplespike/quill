# False success in the merge gate

Run 42959473763 evaluated PR 1326 from main `bcbb2df3`. The fleet-merge-gate App token was minted. The gate then read GraphQL `headRepository` five times, logged that the head repository was unknown, and exited 0. It did not merge.

PR 1340 changed the token and left both the field and the exit in place. An empty value took the path written for a known foreign repository. A green workflow is the wrong result for that read.

Treat a missing value as unknown. After the retries, exit 1 and name the read that failed. Read REST `head.repo` on the pulls API. That is the field a pull-request permission returns. Do not copy another credential to make the GraphQL field appear. A known foreign head still exits 0 and does not merge.

The same gate also counted every non-stale check run. On PR 1325, head `cc4596fab7fefa5530a036097cb94afd5429e272` had a cancelled `PR checks` run and a later success of that same workflow on that same commit. The cancelled predecessor made `red=1`.

Keep the latest attempt of one identity: the app, the workflow path, and the job name. Order attempts by the workflow start time, the attempt number, the workflow run id, and then the check run id. Do not collapse two workflows that share a job name. Do not drop a cancelled run that has no later attempt. Do not prefer an older success over a newer failure or a newer pending run. Do not mix commits. A missing identity or a failed API read exits 1.
