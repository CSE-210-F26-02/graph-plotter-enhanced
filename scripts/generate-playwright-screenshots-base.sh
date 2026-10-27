# Match the Docker image to your installed Playwright version
v=$(npx playwright --version | sed 's/Version //' | tr -d '[:space:]')

# Clear the directory for screenshots
rm -rf ./screenshots
mkdir -p ./screenshots

docker run --rm --ipc=host \
  -v "${PWD}:/work" \
  -v /work/node_modules \
  -w /work \
  "mcr.microsoft.com/playwright:v${v}-noble" \
  /bin/bash -c "npm ci && npx playwright test --update-snapshots"