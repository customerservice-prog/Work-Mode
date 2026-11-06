$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function DownloadVerified([string]$Uri, [string]$Destination, [string]$ExpectedHash, [long]$MinimumBytes) {
    New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
    Write-Host "Downloading and verifying: $(Split-Path $Destination -Leaf)"
    & curl.exe --location --fail --retry 3 --retry-delay 5 --connect-timeout 30 --output $Destination $Uri
    if ($LASTEXITCODE -ne 0) { throw "Download failed for $Destination (exit $LASTEXITCODE)" }
    $file = Get-Item -LiteralPath $Destination
    if ($file.Length -lt $MinimumBytes) { throw "Downloaded file is unexpectedly small: $Destination $($file.Length) bytes" }
    $actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $ExpectedHash.ToLowerInvariant()) {
        Remove-Item -LiteralPath $Destination -Force
        throw "SHA256 mismatch for $Destination. Refusing to package unverified executable or model."
    }
    Write-Host "Verified SHA256 and size for $($file.Name): $([math]::Round($file.Length/1MB, 1)) MB"
}
$root = (Resolve-Path '.').Path
$runtime = Join-Path $root 'desktop-runtime'
$engine = Join-Path $runtime 'engine'
$models = Join-Path $runtime 'models'
$licenses = Join-Path $runtime 'licenses'
New-Item -ItemType Directory -Force -Path $engine,$models,$licenses | Out-Null
$archive = Join-Path $env:RUNNER_TEMP 'llama-b12179-win-cpu-x64.zip'
DownloadVerified 'https://github.com/ggml-org/llama.cpp/releases/download/b12179/llama-b12179-bin-win-cpu-x64.zip' $archive '38d155949752e08f7ca0085feca3f5133be5a6906041feb2ee8683740f3f1a63' 20000000
$extract = Join-Path $env:RUNNER_TEMP 'workmode-llama-unpacked'
Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
$llamaServer = Get-ChildItem -Path $extract -Recurse -Filter 'llama-server.exe' -File | Select-Object -First 1
if ($null -eq $llamaServer) { throw 'Pinned llama.cpp release did not contain llama-server.exe' }
Copy-Item -Path (Join-Path $llamaServer.DirectoryName '*') -Destination $engine -Recurse -Force
if (!(Test-Path (Join-Path $engine 'llama-server.exe'))) { throw 'The packaged llama.cpp engine is missing' }
DownloadVerified 'https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf' (Join-Path $models 'Qwen3-0.6B-Q4_K_M.gguf') 'ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a' 350000000
DownloadVerified 'https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF/resolve/main/Qwen3-1.7B-Q4_K_M.gguf' (Join-Path $models 'Qwen3-1.7B-Q4_K_M.gguf') 'd2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5' 1200000000

@'
Work-Mode includes separately licensed third-party components.
Neither model is affiliated with OpenAI or ChatGPT Work.
llama.cpp, MIT License, release b12179:
https://github.com/ggml-org/llama.cpp
Qwen3-0.6B (Unsloth GGUF), Apache License 2.0:
https://huggingface.co/unsloth/Qwen3-0.6B-GGUF
Qwen3-1.7B (ggml-org GGUF), Apache License 2.0:
https://huggingface.co/ggml-org/Qwen3-1.7B-GGUF
'@ | Set-Content -LiteralPath (Join-Path $licenses 'THIRD-PARTY-NOTICES.txt') -Encoding utf8
& curl.exe --location --fail --retry 2 --output (Join-Path $licenses 'llama-MIT-LICENSE.txt') 'https://raw.githubusercontent.com/ggml-org/llama.cpp/b12179/LICENSE'
if ($LASTEXITCODE -ne 0) { throw 'Could not package llama.cpp MIT license' }
& curl.exe --location --fail --retry 2 --output (Join-Path $licenses 'Apache-2.0-LICENSE.txt') 'https://www.apache.org/licenses/LICENSE-2.0.txt'
if ($LASTEXITCODE -ne 0) { throw 'Could not package model Apache 2.0 license' }
Write-Host 'All bundled AI assets downloaded, verified and ready for Windows packaging.'
