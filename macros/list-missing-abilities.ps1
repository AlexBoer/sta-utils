$d = Get-Content 'c:\Users\alex\AppData\Local\FoundryVTT\Data\modules\sta-utils\scripts\npc-builder\species-catalog.json' -Raw | ConvertFrom-Json
$d.species | Where-Object { (-not $_.abilityName) -and (-not $_.talentUuid) } | ForEach-Object { $_.name } | Sort-Object
