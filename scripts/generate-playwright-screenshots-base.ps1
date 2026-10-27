# Match the Docker image to your installed Playwright version
$v = ((npx playwright --version) -replace 'Version ', '').Trim()

# Clear the directory for screenshots
Remove-Item -Recurse -Force ./screenshots -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path ./screenshots | Out-Null

docker run --rm --ipc=host `
  -v "${PWD}:/work" `
  -v /work/node_modules `
  -w /work `
  "mcr.microsoft.com/playwright:v${v}-noble" `
  /bin/bash -c "npm ci && npx playwright test --update-snapshots"