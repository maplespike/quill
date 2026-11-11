# BEGIN select-merge-checks.jq
# Authoritative check selection for one head SHA.
# Actions identity is app id + workflow path + job name. Attempt order is
# workflow run_started_at, run_attempt, workflow run id, then check run id.
# A newer failure beats an older success. A cancelled run is dropped only
# when a later attempt of that same identity exists. Friendly name alone is
# not an identity. Commit statuses use context, then updated_at, then id.
# The gate excludes only this run, or an earlier run whose workflow path is
# the gate file. A missing path or app does not exclude a job.
def blank($v):
  ($v | type) != "string" or $v == "";

def collect_pages($pages; $key):
  if ($pages | map(select((type == "object") and has("message") and (has($key) | not))) | length) > 0 then
    {
      items: [],
      error: (
        $key + " read failed: " + (
          [ $pages[] | select((type == "object") and has("message")) | (.message | tostring) ] | first // "unknown error"
        )
      )
    }
  else
    (
      [ $pages[] | if type == "array" then .[] else .[$key][]? end ]
    ) as $items
    | (
        [ $pages[] | if (type == "object") and (.total_count | type) == "number" then .total_count else empty end ] | max // null
      ) as $total
    | if $total != null and ($items | length) < $total then
        { items: [], error: ($key + " page is incomplete: have " + ($items | length | tostring) + " of " + ($total | tostring)) }
      else
        { items: $items, error: null }
      end
  end;

def actions_run_id($c):
  [ ($c.details_url // ""), ($c.html_url // "") ]
  | map(select(type == "string" and test("actions/runs/[0-9]+")))
  | map(capture("actions/runs/(?<id>[0-9]+)").id)
  | unique
  | if length == 0 then { id: null, error: null }
    elif length > 1 then { id: null, error: "check run has two Actions run ids" }
    else { id: .[0], error: null }
    end;

def same_app($c):
  ($app_slug | type) == "string"
  and $app_slug != ""
  and (($c.app.slug? // "") == $app_slug);

def gate_named($c):
  (($c.name // "") == $job) or (($c.name // "") == $workflow);

def url_is_this_run($c):
  ($run_id | type) == "string"
  and ($run_id | test("^[0-9]+$"))
  and (
    (($c.details_url // "") | contains("/actions/runs/" + $run_id + "/"))
    or (($c.html_url // "") | contains("/actions/runs/" + $run_id + "/"))
  );

# Name plus app is not enough. The URL of this run is this execution. An older
# gate run must resolve to the gate workflow path. Otherwise the check stays
# in the tally, or a later missing-path read fails closed.
def is_gate($c; $index):
  if same_app($c) and gate_named($c) and url_is_this_run($c) then true
  elif (same_app($c) | not) or (gate_named($c) | not) or $workflow_path == "" then false
  else
    actions_run_id($c) as $rid
    | if $rid.error != null or $rid.id == null or $index.map[$rid.id] == null then false
      else ($index.map[$rid.id].path == $workflow_path)
      end
  end;

# Statuses are a JSON array. GitHub documents completeness with the Link
# rel=next header, not total_count. A page without that proof is incomplete.
# A next link on the last page, a page after a finished page, or an error
# body fails the read. Item count is not a substitute for the link.
def collect_status_pages($pages):
  if ($pages | length) == 0 then
    { items: [], error: "commit status pagination produced no pages" }
  else
    reduce $pages[] as $p (
      { items: [], error: null, index: 0, open: false };
      if .error != null then .
      else
        .index += 1
        | if ($p | type) != "object" or (($p | has("http_status")) | not) or (($p | has("next")) | not) or (($p | has("body")) | not) then
            .error = "commit status page is missing Link pagination proof"
          elif ($p.http_status | type) != "number" or $p.http_status < 200 or $p.http_status >= 300 then
            .error = ("commit status page returned HTTP " + ($p.http_status | tostring) + (if ($p.body | type) == "object" and ($p.body.message | type) == "string" then ": " + $p.body.message else "" end))
          elif ($p.body | type) == "object" and ($p.body | has("message")) then
            .error = ("commit status page failed: " + ($p.body.message | tostring))
          elif ($p.body | type) != "array" then
            .error = "commit status page body is not an array"
          elif (.open | not) and .index > 1 then
            .error = "commit status pagination has a page after a page with no next Link"
          elif $p.next != null and (($p.next | type) != "string" or $p.next == "") then
            .error = "commit status next Link is empty"
          else
            .items += $p.body
            | .open = ($p.next != null)
          end
      end
    )
    | if .error != null then { items: [], error: .error }
      elif .open then { items: [], error: "commit status pagination stopped while a next Link remained" }
      else { items: .items, error: null }
      end
  end;

def check_bucket($c):
  if ($c.status // "") != "completed" then "pending"
  elif (($c.conclusion // "") == "success" or ($c.conclusion // "") == "skipped" or ($c.conclusion // "") == "neutral") then "green"
  elif ($c.conclusion // "") == "stale" then "stale"
  elif blank($c.conclusion // "") then "unknown"
  else "red"
  end;

def status_bucket($s):
  if ($s.state // "") == "success" then "green"
  elif ($s.state // "") == "pending" then "pending"
  elif (($s.state // "") == "failure" or ($s.state // "") == "error") then "red"
  else "unknown"
  end;

def better($a; $b):
  if $a == null then $b
  elif $b == null then $a
  elif $a.ord > $b.ord then $a
  else $b
  end;

def tally($rows):
  {
    pending: ([$rows[] | select(.bucket == "pending")] | length),
    red: ([$rows[] | select(.bucket == "red")] | length),
    green: ([$rows[] | select(.bucket == "green")] | length),
    pending_names: ([$rows[] | select(.bucket == "pending") | .label] | join(", ")),
    red_names: ([$rows[] | select(.bucket == "red") | .label] | join(", "))
  };

def finish($error; $checks; $statuses):
  if $error != null then
    { ok: false, error: $error, checks: { pending: 0, red: 0, green: 0, pending_names: "", red_names: "" }, statuses: { pending: 0, red: 0, green: 0, pending_names: "", red_names: "" } }
  else
    { ok: true, error: "", checks: $checks, statuses: $statuses }
  end;

collect_pages($check_pages; "check_runs") as $checks_in
| collect_pages($run_pages; "workflow_runs") as $runs_in
| collect_status_pages($status_pages) as $statuses_in
| if $checks_in.error != null then finish($checks_in.error; null; null)
  elif $runs_in.error != null then finish($runs_in.error; null; null)
  elif $statuses_in.error != null then finish($statuses_in.error; null; null)
  elif ($required | type) != "array" then finish("required check list is not an array"; null; null)
  else
    (
      reduce $runs_in.items[] as $w (
        { map: {}, error: null };
        if .error != null then .
        elif ($w.id | type) != "number" then .error = "workflow run is missing id"
        elif blank($w.head_sha // "") then .error = ("workflow run " + ($w.id | tostring) + " is missing head_sha")
        elif $w.head_sha != $head_sha then .
        elif blank($w.path // "") then .error = ("workflow run " + ($w.id | tostring) + " is missing path")
        elif ($w.run_attempt | type) != "number" then .error = ("workflow run " + ($w.id | tostring) + " is missing run_attempt")
        elif blank($w.run_started_at // "") then .error = ("workflow run " + ($w.id | tostring) + " is missing run_started_at")
        elif (.map[$w.id | tostring] != null) and (.map[$w.id | tostring].path != $w.path) then
          .error = ("workflow run " + ($w.id | tostring) + " has two paths")
        else
          .map[$w.id | tostring] = {
            path: $w.path,
            attempt: $w.run_attempt,
            started: $w.run_started_at,
            id: $w.id
          }
        end
      )
    ) as $index
    | if $index.error != null then finish($index.error; null; null)
      else
        (
          reduce $checks_in.items[] as $c (
            { rows: [], error: null };
            if .error != null then .
            elif is_gate($c; $index) then .
            elif ($c.id | type) != "number" then .error = "check run is missing id"
            elif blank($c.head_sha // "") then .error = ("check run " + ($c.id | tostring) + " is missing head_sha")
            elif $c.head_sha != $head_sha then .
            elif blank($c.name // "") then .error = ("check run " + ($c.id | tostring) + " is missing name")
            elif ($c.app.id? | type) != "number" then .error = ("check run " + ($c.id | tostring) + " is missing app.id")
            elif blank($c.status // "") then .error = ("check run " + ($c.id | tostring) + " is missing status")
            elif check_bucket($c) == "stale" then .
            elif check_bucket($c) == "unknown" then .error = ("check run " + ($c.id | tostring) + " has an unknown conclusion")
            else
              actions_run_id($c) as $rid
              | if $rid.error != null then .error = ("check run " + ($c.id | tostring) + " " + $rid.error)
                elif $rid.id != null then
                  if $index.map[$rid.id] == null then
                    .error = ("check run " + ($c.id | tostring) + " (" + $c.name + ") has no same-SHA workflow metadata for Actions run " + $rid.id)
                  else
                    ($index.map[$rid.id]) as $w
                    | .rows += [{
                        key: (["actions", $c.app.id, $w.path, $c.name] | tojson),
                        ord: [$w.started, $w.attempt, $w.id, $c.id],
                        bucket: check_bucket($c),
                        name: $c.name,
                        path: $w.path,
                        app_id: $c.app.id,
                        label: ($w.path + " :: " + $c.name)
                      }]
                  end
                elif blank($c.started_at // "") and blank($c.completed_at // "") then
                  .error = ("check run " + ($c.id | tostring) + " is missing started_at")
                elif (($c.external_id // "") | type) == "string" and (($c.external_id // "") | length) > 0 then
                  .rows += [{
                    key: (["app", $c.app.id, "ext", $c.external_id] | tojson),
                    ord: [($c.started_at // $c.completed_at), 0, 0, $c.id],
                    bucket: check_bucket($c),
                    name: $c.name,
                    path: null,
                    app_id: $c.app.id,
                    label: ("app:" + ($c.app.id | tostring) + " :: " + $c.name)
                  }]
                elif ($c.check_suite.id? | type) == "number" then
                  .rows += [{
                    key: (["app", $c.app.id, "suite", $c.check_suite.id, "name", $c.name] | tojson),
                    ord: [($c.started_at // $c.completed_at), 0, 0, $c.id],
                    bucket: check_bucket($c),
                    name: $c.name,
                    path: null,
                    app_id: $c.app.id,
                    label: ("app:" + ($c.app.id | tostring) + " :: " + $c.name)
                  }]
                else
                  .error = ("check run " + ($c.id | tostring) + " has no workflow, external_id, or check suite")
                end
            end
          )
        ) as $prepared
        | if $prepared.error != null then finish($prepared.error; null; null)
          else
            (
              reduce $prepared.rows[] as $row (
                {};
                .[$row.key] = better(.[$row.key]; $row)
              )
              | [ .[] ]
            ) as $chosen
            | (
                reduce $required[] as $req (
                  { rows: $chosen, error: null };
                  if .error != null then .
                  elif blank($req.path // "") or blank($req.name // "") then .error = "required check is missing path or name"
                  else
                    ( [ .rows[] | select(.path == $req.path and .name == $req.name) ] ) as $hits
                    | if ($hits | length) == 0 then
                        .rows += [{
                          key: (["required", $req.path, $req.name] | tojson),
                          ord: ["", 0, 0, 0],
                          bucket: "red",
                          name: $req.name,
                          path: $req.path,
                          app_id: null,
                          label: ("missing required :: " + $req.path + " :: " + $req.name)
                        }]
                      else .
                      end
                  end
                )
              ) as $with_required
            | if $with_required.error != null then finish($with_required.error; null; null)
              else
                (
                  reduce $statuses_in.items[] as $s (
                    { rows: [], error: null };
                    if .error != null then .
                    elif ($s.id | type) != "number" then .error = "commit status is missing id"
                    elif (($s.sha // null) != null) and ($s.sha != $head_sha) then .
                    elif blank($s.context // "") then .error = ("commit status " + ($s.id | tostring) + " is missing context")
                    elif blank($s.updated_at // "") and blank($s.created_at // "") then .error = ("commit status " + ($s.id | tostring) + " is missing updated_at")
                    elif status_bucket($s) == "unknown" then .error = ("commit status " + ($s.id | tostring) + " has an unknown state")
                    else
                      .rows += [{
                        key: $s.context,
                        ord: [($s.updated_at // $s.created_at), $s.id],
                        bucket: status_bucket($s),
                        label: $s.context
                      }]
                    end
                  )
                ) as $status_rows
                | if $status_rows.error != null then finish($status_rows.error; null; null)
                  else
                    (
                      reduce $status_rows.rows[] as $row (
                        {};
                        .[$row.key] = better(.[$row.key]; $row)
                      )
                      | [ .[] ]
                    ) as $status_chosen
                    | finish(null; tally($with_required.rows); tally($status_chosen))
                  end
              end
          end
      end
  end
# END select-merge-checks.jq
