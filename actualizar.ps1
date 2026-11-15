# Actualiza el proyecto con un zip nuevo, conservando tu archivo .env y tu base de datos.
# Uso (desde PowerShell, dentro de la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File .\actualizar.ps1 -Zip "C:\Users\artur\Downloads\fargoz-inventario.zip"
param([Parameter(Mandatory = $true)][string]$Zip)
$ErrorActionPreference = "Stop"
$proj = $PSScriptRoot
if (-not (Test-Path (Join-Path $proj ".env"))) { throw "No encuentro el archivo .env en $proj" }
if (-not (Test-Path $Zip)) { throw "No encuentro el zip: $Zip" }

Copy-Item (Join-Path $proj ".env") (Join-Path $proj ".env.respaldo") -Force
Write-Host "Respaldo de .env guardado como .env.respaldo"

$tmp = Join-Path $env:TEMP ("fargoz-upd-" + [guid]::NewGuid())
Expand-Archive -Path $Zip -DestinationPath $tmp -Force
$nuevo = Get-ChildItem $tmp -Recurse -Filter docker-compose.yml | Select-Object -First 1
if (-not $nuevo) { throw "El zip no contiene docker-compose.yml" }

Get-ChildItem $nuevo.Directory.FullName -Force |
    Where-Object { $_.Name -notin @(".env", "actualizar.ps1") } |
    ForEach-Object { Copy-Item $_.FullName $proj -Recurse -Force }
Remove-Item $tmp -Recurse -Force
Write-Host "Archivos actualizados. Reconstruyendo (puede tardar unos minutos)..."

Set-Location $proj
docker compose up -d --build
docker compose ps
Write-Host "Listo. Abre http://localhost:3000"
