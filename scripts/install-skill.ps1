param(
  [string]$SkillSource = (Join-Path $PSScriptRoot "..\skills\pms-project-management\SKILL.md"),
  [string]$Destination = (Join-Path $HOME ".codex\skills\pms-project-management\SKILL.md")
)

$destinationDirectory = Split-Path -Parent $Destination
New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
Copy-Item -LiteralPath $SkillSource -Destination $Destination -Force
Write-Output "Installed PMS skill to $Destination"
