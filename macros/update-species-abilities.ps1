# Updates both species-catalog.json files:
#  1. Adds abilityName to existing species entries
#  2. Inserts new species entries in alphabetical order
# Uses single-quoted PS strings throughout to avoid Unicode quote encoding issues.

$LQ = [char]0x201C  # LEFT DOUBLE QUOTATION MARK - used in Sokath talent name
$RQ = [char]0x201D  # RIGHT DOUBLE QUOTATION MARK

$abilityMap = @{
    'Android (Soong-type)' = 'Synthetic Life-Form'
    'Aurelian'             = 'Airborne Avian'
    'Barzan'               = 'Unyielding Resolve'
    'Benzite'              = 'All Fingers and Thumbs'
    'Betelgeusian'         = 'Hardened for Battle'
    'Bolian'               = 'Amiable'
    'Bynar'                = 'Bynar Pair'
    'Caitian'              = 'Feline Form'
    'Cetacean'             = 'Aquatic Mammal'
    'Changeling'           = 'Morphogenic Matrix'
    'Deltan'               = 'Empath'
    'Edosian'              = 'Trilateral Symmetry'
    'Efrosian'             = 'Visual Spectrum'
    'El-Aurian'            = 'Transtemporal Awareness'
    'Exocomp'              = 'Technological Life'
    'Grazerite'            = 'Agreeable'
    'Hologram'             = 'Photonic'
    'Horta'                = 'Silicon-Based Burrower'
    'Illyrian'             = 'Adapt and Excel'
    "Jem'Hadar"            = 'Perfect Soldier'
    'Kelpien'              = 'Hunter or Prey'
    "Klingon (QuchHa')"    = 'Superior Ambition'
    'Ktarian'              = 'Deep Determination'
    'Kzinti'               = 'Feline Predator'
    'Lanthanite'           = 'Lived Nearly Forever'
    'Liberated Borg'       = 'Borg Implants'
    'Lurian'               = 'Resistant Anatomy'
    'Nausicaan'            = 'Brute Force'
    'Ocampa'               = 'Extraordinary Mind'
    'Osnullus'             = 'Unreadable Face'
    'Pakled'               = 'Straightforward'
    'Reman'                = 'Born to the Dark'
    'Rigellian Chelon'     = 'Atavistic Defenses'
    'Rigellian Jelna'      = 'Divergent Physiology'
    'Risian'               = 'Clarity in Peace'
    'Saurian'              = 'Superior Metabolism'
    "Son'a"                = 'At All Costs'
    'Talaxian'             = 'Widely Traveled'
    'Vorta'                = 'The Voice of the Founders'
    'Xahean'               = 'Camouflage Field'
    'Xindi-Arboreal'       = 'Calm Under Pressure'
    'Xindi-Insectoid'      = 'Insectoid'
    'Xindi-Primate'        = 'Adaptable and Talented'
    'Xindi-Reptilian'      = 'Durable Physiology'
    'Yridian'              = 'Eidetic Memory'
    'Zakdorn'              = 'Several Moves Ahead'
}

# New species not yet in the catalog (attributeBonuses null = GM/player chooses 3)
$newSpecies = [ordered]@{
    'Blue Orion'    = 'Honor Among Thieves'
    'Breen'         = 'Gelatinous Form'
    'Brikar'        = 'Rock Hard'
    'Chameloid'     = 'Natural Shapeshifter'
    'Child of Tama' = ('Sokath, ' + $LQ + 'His Eyes Uncovered' + $RQ)
    'Human Augment' = 'Genetically Enhanced'
    'Kellerun'      = 'Intense Defiance'
    'Klowahkan'     = 'Epicurean'
    'Kwejian'       = 'Natural Balance'
    'Medusan'       = 'Sublime Mind, Hideous Form'
    'Nanokin'       = 'Tiny Being in a Lifelike Android'
    'Terran'        = 'Accustomed to Violence'
    "Vau N'Akat"    = 'Neuroflux'
    'Xindi-Aquatic' = 'Aquatic'
}

function Update-Catalog([string]$Path) {
    $lines = [System.IO.File]::ReadAllLines($Path)
    $result = New-Object System.Collections.Generic.List[string]
    [void]$result.AddRange($lines)

    # ---- Step 1: add abilityName to existing entries that don't have one ----
    for ($i = 0; $i -lt $result.Count; $i++) {
        $line = $result[$i]
        if ($line -notmatch '"talentUuid":' -or $line -match '"abilityName"') { continue }

        foreach ($species in $abilityMap.Keys) {
            $esc = [regex]::Escape($species)
            if ($line -match ('"name": "' + $esc + '"')) {
                $ability = $abilityMap[$species]
                $result[$i] = $line.Replace(', "attributeBonuses":', ', "abilityName": "' + $ability + '", "attributeBonuses":')
                break
            }
        }
    }

    # ---- Step 2: insert new species entries in alphabetical order ----
    foreach ($newName in ($newSpecies.Keys | Sort-Object)) {
        $ability = $newSpecies[$newName]
        $newLine = '    { "name": "' + $newName + '", "talentUuid": null, "abilityName": "' + $ability + '", "attributeBonuses": null },'

        # Find the last entry that sorts before this new name
        $insertAfter = -1
        for ($i = 0; $i -lt $result.Count; $i++) {
            if ($result[$i] -match '"talentUuid":' -and $result[$i] -match '"name": "([^"]+)"') {
                $existingName = $Matches[1]
                if ([string]::Compare($existingName, $newName, [System.StringComparison]::InvariantCultureIgnoreCase) -lt 0) {
                    $insertAfter = $i
                }
            }
        }

        if ($insertAfter -ge 0) {
            $result.Insert($insertAfter + 1, $newLine)
        }
        else {
            Write-Warning ('Could not find insertion point for: ' + $newName)
        }
    }

    [System.IO.File]::WriteAllLines($Path, $result, [System.Text.UTF8Encoding]::new($false))
    Write-Host ('Updated: ' + (Split-Path $Path -Leaf) + ' — ' + $result.Count + ' lines')
}

Update-Catalog 'c:\Users\alex\AppData\Local\FoundryVTT\Data\modules\sta-officers-log\scripts\creation\species-catalog.json'
Update-Catalog 'c:\Users\alex\AppData\Local\FoundryVTT\Data\modules\sta-utils\scripts\npc-builder\species-catalog.json'

Write-Host 'Done.'
