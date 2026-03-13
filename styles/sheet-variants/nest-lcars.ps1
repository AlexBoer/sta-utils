#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Transforms sta-lcars.css flat rules into CSS nested form per section.
  Each section's root selector becomes the outer block; child selectors
  have the root prefix stripped.
#>

$src = Join-Path $PSScriptRoot "sta-lcars.css"
$dst = Join-Path $PSScriptRoot "sta-lcars.css"   # overwrite in-place

$raw  = [System.IO.File]::ReadAllText($src)
# Normalise line endings
$raw  = $raw -replace "`r`n", "`n"

# ─── Section definitions ──────────────────────────────────────────────────────
# Each entry: (prefix, section start/end markers, extra compound selectors map)
#   "startMarker" – a unique string that marks the BEGIN of this section
#   "endMarker"   – but we just use the next section's startMarker as the split
# We process sections by splitting the file on known boundaries.
# ─────────────────────────────────────────────────────────────────────────────

# Helper: escape a string for use inside a regex
function EscapeRegex([string]$s) { [regex]::Escape($s) }

# Given a flat-CSS section text and a root prefix, return it nested.
function Nest-Section {
  param([string]$text, [string]$prefix)

  # We want to:
  #  (a) Merge all "root" blocks (selector exactly == $prefix) into ONE root block.
  #  (b) Strip "$prefix " from child selectors (space after prefix).
  #  (c) Replace "$prefix." with "&." (compound class).
  #  (d) Replace " $prefix" at end of multi-selector lines with " &" (ancestor ctx).

  $ep         = EscapeRegex $prefix
  $root_props = [System.Text.StringBuilder]::new()

  # Step 1: Extract all root blocks' content (recursively collect properties)
  # Regex: match selector==prefix {body}
  $root_pattern = "(?m)^($ep)\s*\{([^{}]*)\}"
  $root_matches = [regex]::Matches($text, $root_pattern)
  foreach ($m in $root_matches) {
    $body = $m.Groups[2].Value
    if ($root_props.Length -gt 0) {
      [void]$root_props.AppendLine()
    }
    [void]$root_props.Append($body.Trim())
  }
  # Remove root blocks from the text so we don't duplicate them
  $text = [regex]::Replace($text, $root_pattern, "`n")

  # Step 2: Handle compound selectors: "prefix.extra" -> "&.extra"
  #   (only when followed by a space, comma, or opening brace)
  $text = [regex]::Replace($text, "(^|,\s*\n?)$ep(\.[^ {,\r\n]+)", '$1&$2', [System.Text.RegularExpressions.RegexOptions]::Multiline)

  # Step 3: Handle ancestor selectors: " prefix" (space before, no following space-child)
  #   e.g. ".ancestor $prefix {" -> ".ancestor & {"
  $text = [regex]::Replace($text, "(?<!\S)$ep(?=\s*[{,])", "&", [System.Text.RegularExpressions.RegexOptions]::Multiline)

  # Step 4: Strip child prefix: "prefix .child" -> ".child"  (prefix + space)
  $text = [regex]::Replace($text, "(^|,\s*\n?)$ep ", '$1', [System.Text.RegularExpressions.RegexOptions]::Multiline)
  $text = $text -replace "(^|\n)$ep\s+", '$1'

  # Step 5: Indent every non-blank line by 2 spaces
  $lines = $text -split "`n"
  $indented = $lines | ForEach-Object {
    if ($_.Trim() -eq '') { '' } else { '  ' + $_ }
  }
  $inner = $indented -join "`n"

  # Step 6: Build the nested block
  $root_content = $root_props.ToString().Trim()
  $sep = if ($root_content -ne '' -and $inner.Trim() -ne '') { "`n`n" } else { "" }
  $nested = "$prefix {`n"
  if ($root_content -ne '') {
    # Indent root content too
    $rc_lines = $root_content -split "`n"
    $rc_indented = $rc_lines | ForEach-Object { if ($_.Trim() -eq '') { '' } else { '  ' + $_ } }
    $nested += ($rc_indented -join "`n")
  }
  if ($inner.Trim() -ne '') {
    $nested += $sep + $inner.TrimEnd()
  }
  $nested += "`n}"
  return $nested
}

# ─── Define section boundaries ────────────────────────────────────────────────
# We'll split the file at the LARGE section comment blocks.
# These are identified by the "* *" style banners in the file.

$section_boundaries = @(
  [PSCustomObject]@{
    Prefix      = ".character-sheet.sta-lcars"
    StartMarker = "/* ===============================================================================`n *  LCARS CHARACTER SHEET THEME"
    EndMarker   = "/* ===============================================================================`n * *"
  },
  [PSCustomObject]@{
    Prefix      = ".starship-sheet.sta-lcars"
    StartMarker = "STARSHIP / SMALL CRAFT SHEET"
    EndMarker   = "EXTENDED TASK SHEET"
  },
  [PSCustomObject]@{
    Prefix      = ".extended-tasks.sta-lcars"
    StartMarker = "EXTENDED TASK SHEET"
    EndMarker   = "ITEM SHEET"
  },
  [PSCustomObject]@{
    Prefix      = ".item-sheet.sta-lcars"
    StartMarker = "ITEM SHEET"
    EndMarker   = "SCENE TRAITS SHEET"
  },
  [PSCustomObject]@{
    Prefix      = ".scenetraits-sheet.sta-lcars"
    StartMarker = "SCENE TRAITS SHEET"
    EndMarker   = "DIALOGUE (DICE POOL)"
  },
  [PSCustomObject]@{
    Prefix      = ".dialogue.sta-lcars"
    StartMarker = "DIALOGUE (DICE POOL)"
    EndMarker   = "STA OFFICERS LOG"
  },
  [PSCustomObject]@{
    Prefix      = "body.sta-officers-lcars-active"
    StartMarker = "STA OFFICERS LOG"
    EndMarker   = $null   # last section
  }
)

# Process each section
foreach ($sec in $section_boundaries) {
  $startIdx = $raw.IndexOf($sec.StartMarker)
  if ($startIdx -lt 0) {
    Write-Warning "Could not find start marker for $($sec.Prefix)"
    continue
  }

  if ($null -ne $sec.EndMarker) {
    $endIdx = $raw.IndexOf($sec.EndMarker, $startIdx + $sec.StartMarker.Length)
    if ($endIdx -lt 0) {
      Write-Warning "Could not find end marker for $($sec.Prefix)"
      continue
    }
    $sectionText = $raw.Substring($startIdx, $endIdx - $startIdx)
    $remainder   = $raw.Substring($endIdx)
  } else {
    $sectionText = $raw.Substring($startIdx)
    $remainder   = ''
  }

  Write-Host "Processing $($sec.Prefix) ($(($sectionText -split "`n").Count) lines)…"

  $nested = Nest-Section -text $sectionText -prefix $sec.Prefix
  $raw = $raw.Substring(0, $startIdx) + $nested + "`n`n" + $remainder
}

# Write output
[System.IO.File]::WriteAllText($dst, $raw, [System.Text.Encoding]::UTF8)
Write-Host "Done. Wrote $(($raw -split "`n").Count) lines to $dst"
