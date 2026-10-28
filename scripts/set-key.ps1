# Asks for the Meta Model API key (input hidden) and writes it to .env next to this repo.
$envPath = Join-Path $PSScriptRoot '..\.env'
$secure = Read-Host 'Wklej klucz Meta API (Ctrl+V lub prawy przycisk myszy), potem Enter' -AsSecureString
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $key) { Write-Host 'Pusto - nic nie zapisano.'; exit 1 }
$budget = 5
if (Test-Path $envPath) {
  $line = Select-String -Path $envPath -Pattern '^DAILY_BUDGET_USD=(.+)$' | Select-Object -First 1
  if ($line) { $budget = $line.Matches[0].Groups[1].Value.Trim() }
}
[IO.File]::WriteAllText((Resolve-Path (Split-Path $envPath)).Path + '\.env', "MODEL_API_KEY=$key`nDAILY_BUDGET_USD=$budget`n")
Write-Host "Zapisano klucz ($($key.Length) znakow) do .env"
