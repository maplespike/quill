# BEGIN normalize-pull.jq
# REST GET /repos/{owner}/{repo}/pulls/{n} under the token that can read
# pull requests. GraphQL headRepository is not a field of this object, and a
# null head.repo stays an empty headRepo. Callers must not treat that empty
# value as a foreign repository.
{
  state: ((.state // "") | ascii_upcase),
  isDraft: (.draft == true),
  mergeable: (
    if .mergeable == true then "MERGEABLE"
    elif .mergeable == false then "CONFLICTING"
    else "UNKNOWN"
    end
  ),
  mergeStateStatus: ((.mergeable_state // "") | ascii_upcase),
  headRepo: (if (.head.repo // null) == null then "" else (.head.repo.full_name // "") end),
  headRefOid: (.head.sha // ""),
  labels: (if (.labels | type) == "array" then .labels else [] end),
  author: { login: (.user.login // "") },
  title: (.title // ""),
  body: (.body // ""),
  commits: (if (.commits | type) == "array" then .commits else [] end)
}
# END normalize-pull.jq
