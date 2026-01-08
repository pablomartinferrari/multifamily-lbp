$thumbprint = "5361702685A4F695B2644D4E24FD8D8540301766"
$cert = Get-ChildItem Cert:\CurrentUser\My\$thumbprint
$pwd = ConvertTo-SecureString -String "XrfCert2026!" -Force -AsPlainText
$pfxPath = Join-Path $PSScriptRoot "XRF-Processor-Cert.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd
Write-Host "PFX exported to: $pfxPath" -ForegroundColor Green
Write-Host "Password: XrfCert2026!" -ForegroundColor Cyan
