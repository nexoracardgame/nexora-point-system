$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'artifacts/game-icons'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$expected = [System.Drawing.Bitmap]::new((Join-Path $root 'public/game-assets/branding/icon-32.png'))
try {
    foreach ($entry in @(
        @{ Name='game'; Path='dist/game-desktop/win-unpacked/NEXORA CARD GAME.exe' },
        @{ Name='installer'; Path='dist/game-desktop/NEXORA-CARD-GAME-Setup-1.0.10.exe' }
    )) {
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $root $entry.Path))
        $bitmap = $icon.ToBitmap()
        try {
            if ($bitmap.Width -ne 32 -or $bitmap.Height -ne 32) { throw 'Unexpected Windows icon size' }
            $difference = 0.0
            for ($y=0; $y -lt 32; $y++) {
                for ($x=0; $x -lt 32; $x++) {
                    $a = $bitmap.GetPixel($x,$y)
                    $b = $expected.GetPixel($x,$y)
                    $difference += [Math]::Abs($a.R*$a.A/255.0-$b.R*$b.A/255.0)
                    $difference += [Math]::Abs($a.G*$a.A/255.0-$b.G*$b.A/255.0)
                    $difference += [Math]::Abs($a.B*$a.A/255.0-$b.B*$b.A/255.0)
                }
            }
            $average = $difference/(32*32*3)
            if ($average -gt 2) { throw "Embedded icon differs from official icon: $average" }
            $bitmap.Save((Join-Path $output ($entry.Name+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output ($entry.Name+': official icon embedded, average pixel difference '+$average)
        } finally { $bitmap.Dispose(); $icon.Dispose() }
    }
} finally { $expected.Dispose() }
