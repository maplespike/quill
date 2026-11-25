# BEGIN dependabot-gate.jq
# Decide whether a pull request passes the Dependabot semver-patch/minor gate.
# Non-Dependabot PRs pass unaffected (controlled by ready-to-merge / hold).
# Dependabot PRs (`dependabot[bot]` or `app/dependabot`) auto-merge ONLY when
# every parsed update is semver-patch or semver-minor; major, downgrade,
# prerelease, 0.x minor (semver-breaking), or unparseable updates are
# skipped (allow: false). Commit messages' "update-type:
# version-update:semver-*" lines are parsed when present: the highest
# kind wins, and a disagreement with the title or body is denied.
def clean_ver:
  tostring
  | sub("^[ \\t\\r\\n`\"\u0027(\\[]+"; "")
  | sub("[ \\t\\r\\n`\"\u0027.,;:)\\]]+$"; "")
  | sub("^[vV](?=[0-9])"; "");

def parse_ver:
  clean_ver
  | if test("^[0-9]+(\\.[0-9]+){0,3}$") then
      split(".")
      | map(tonumber)
      | if (length == 1 and .[0] >= 10000) then
          null
        else
          {
            major: .[0],
            minor: (.[1] // 0),
            patch: (.[2] // 0),
            extra: (.[3] // 0)
          }
        end
    else
      null
    end;

def classify_pair($from_raw; $to_raw):
  ($from_raw | parse_ver) as $f
  | ($to_raw | parse_ver) as $t
  | if ($f == null or $t == null) then
      "unknown"
    elif $t.major > $f.major then
      "major"
    elif $t.major < $f.major then
      "unknown"
    elif $t.major == 0 and $f.major == 0 and $t.minor > $f.minor then
      "major"
    elif $t.minor > $f.minor then
      "minor"
    elif $t.minor < $f.minor then
      "unknown"
    elif ($t.patch > $f.patch) or ($t.patch == $f.patch and $t.extra > $f.extra) then
      "patch"
    else
      "unknown"
    end;

def body_preamble:
  (.body // "")
  | gsub("\r\n"; "\n")
  | (split("\n<details")[0] // "")
  | (split("\n---")[0] // "");

def extract_from_to_title:
  (.title // "")
  | capture("(?:^|\\s)from\\s+(?<from>\\S+)\\s+to\\s+(?<to>\\S+)(?:\\s|$)"; "i")?;

def extract_from_to_body($preamble):
  (
    $preamble
    | split("\n")
    | map(select(test("^[ \\t]*(?:bumps|updates)\\s+.*\\s+from\\s+\\S+\\s+to\\s+\\S+"; "i")))
    | .[0]? // empty
    | capture("\\sfrom\\s+(?<from>\\S+)\\s+to\\s+(?<to>\\S+)"; "i")?
  ) // (
    $preamble
    | capture("previous-version=(?<from>[^&\\s)]+)&new-version=(?<to>[^&\\s)]+)"; "i")?
  );

def extract_grouped_rows($preamble):
  [
    $preamble
    | split("\n")[]
    | select(test("^\\s*\\|[^|]+\\|[^|]+\\|[^|]+\\|"))
    | select(test("^\\s*\\|\\s*Package\\s*\\|\\s*From\\s*\\|\\s*To\\s*\\|"; "i") | not)
    | select(test("^\\s*\\|(?:\\s*:?-+:?\\s*\\|)+\\s*$") | not)
    | capture("^\\s*\\|[^|]+\\|\\s*(?:`(?<f1>[^`]+)`|(?<f2>[^|\\s]+))\\s*\\|\\s*(?:`(?<t1>[^`]+)`|(?<t2>[^|\\s]+))\\s*\\|")
    | { from: (.f1 // .f2), to: (.t1 // .t2) }
  ];


def extract_commit_kinds:
  [
    ((.commits // [])[]
      | ((.commit.message // .message // "") | tostring)
      | [scan("update-type:[ \t]*version-update:semver-(major|minor|patch)"; "i")][]
      | if type == "array" then .[0] else . end
    )
  ];

def highest_kind($kinds):
  if ($kinds | any(. == "major")) then "major"
  elif ($kinds | any(. == "minor")) then "minor"
  elif ($kinds | any(. == "patch")) then "patch"
  else
    null
  end;

def disagree($a; $b):
  if ($a == null or $b == null) then
    false
  else
    $a != $b
  end;

def finalize($decision):
  highest_kind(extract_commit_kinds) as $commit_kind
  | if ((.commits // []) | length) > 0 and ($commit_kind == null) then
      { allow: false, kind: "unknown", grouped: $decision.grouped, reason: "Dependabot commits are present but have no parseable update-type: version-update:semver-* lines" }
    elif disagree($commit_kind; $decision.kind) then
      { allow: false, kind: "unknown", grouped: $decision.grouped, reason: "Dependabot commit update-type disagrees with the title or body classification" }
    else
      $decision
    end;

((.author.login // "") | (. == "dependabot[bot]" or . == "app/dependabot")) as $is_dependabot
| if ($is_dependabot | not) then
    { allow: true, kind: "non-dependabot", grouped: false, reason: "author is not Dependabot" }
  else
    (body_preamble as $preamble
    | (((.title // "") | test("bump the [^\\n]+ group"; "i"))
      or ($preamble | test("^[ \\t]*(?:bumps|updates) the [^\\n]+ group"; "i"))) as $is_grouped
    | if $is_grouped then
        extract_grouped_rows($preamble) as $rows
        | if ($rows | length) == 0 then
            { allow: false, kind: "unknown", grouped: true, reason: "grouped Dependabot PR has no parseable version table" }
          else
            ($rows | map(classify_pair(.from; .to))) as $kinds
            | if ($kinds | any(. == "major")) then
                { allow: false, kind: "major", grouped: true, reason: "grouped Dependabot PR contains a semver-major update" }
              elif ($kinds | any(. == "unknown")) then
                { allow: false, kind: "unknown", grouped: true, reason: "grouped Dependabot PR contains an unknown or unsupported version transition" }
              elif ($kinds | all(. == "patch")) then
                { allow: true, kind: "patch", grouped: true, reason: "all grouped Dependabot updates are semver-patch" }
              else
                { allow: true, kind: "minor", grouped: true, reason: "all grouped Dependabot updates are semver-minor or patch" }
              end
          end
      else
        (extract_from_to_title // null) as $t_pair
        | (extract_from_to_body($preamble) // null) as $b_pair
        | if ($t_pair == null and $b_pair == null) then
            { allow: false, kind: "unknown", grouped: false, reason: "could not parse from/to versions from Dependabot PR title or body" }
          else
            (if $t_pair != null then classify_pair($t_pair.from; $t_pair.to) else null end) as $t_kind
            | (if $b_pair != null then classify_pair($b_pair.from; $b_pair.to) else null end) as $b_kind
            | if ($t_kind != null and $b_kind != null and $t_kind != $b_kind) then
                if ($t_kind == "major" or $b_kind == "major") then
                  { allow: false, kind: "major", grouped: false, reason: "Dependabot update includes a semver-major transition" }
                else
                  { allow: false, kind: "unknown", grouped: false, reason: "Dependabot title and body versions classify differently" }
                end
              else
                ($t_kind // $b_kind) as $kind
                | if $kind == "patch" then
                    { allow: true, kind: "patch", grouped: false, reason: "Dependabot update is semver-patch" }
                  elif $kind == "minor" then
                    { allow: true, kind: "minor", grouped: false, reason: "Dependabot update is semver-minor" }
                  elif $kind == "major" then
                    { allow: false, kind: "major", grouped: false, reason: "Dependabot update is semver-major" }
                  else
                    { allow: false, kind: "unknown", grouped: false, reason: "Dependabot update version transition is unknown or unsupported" }
                  end
              end
          end
      end
    ) as $decision | finalize($decision)
  end
# END dependabot-gate.jq
