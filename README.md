# Description

This is a simple Playwright test that can be used to upload a Stellaris mod to the PDX Mods.

This could potentially be used for other games as well, but I have not tested it.

# Available environment variables

| Variable | Description | Default value |
| -------- | ----------- | ------------- |
| `EMAIL` | The username to use for logging in | — |
| `PASSWORD` | The password to use for logging in | — |
| `MOD_FOLDER_PATH` | The path towards the mod folder relative to `__dirname` | `${__dirname}/mod` |
| `MOD_ARCHIVE_PATH` | The path towards the mod archive relative to `__dirname` | `${__dirname}/mod.zip` |
| `MOD_ID` | The ID of the mod on PDX Mods | — |
| `MOD_VERSION` | The version of the mod | parsed from `descriptor.mod` |
| `GAME_VERSION` | The version of the game the mod is compatible with | parsed from `descriptor.mod` |
| `UPLOAD_TIMEOUT` | The timeout for the upload in milliseconds | `60_000 * 20` (20 mins) |
| `RELEASE_NOTES` | The release notes to use when submitting the new version | `No release notes provided.` |



# Usage

## Directly

### Requirements

- node.js v20.11+
- yarn v1.22+

### Steps

1. Clone the repository
2. Run `yarn install`
3. Copy `.env.example` to `.env` and change it to your needs (`EMAIL`, `PASSWORD` and `MOD_ID` are required, see [Available environment variables](#available-environment-variables))
4. Run `yarn start`

## Docker image

A docker image is built every time a new tag is pushed to the repository (`ghcr.io/the24thds/pdx-mods-stellaris-uploader`). You can see the available tags on the [package page](https://github.com/The24thDS/pdx-mods-stellaris-uploader/pkgs/container/pdx-mods-stellaris-uploader).

This image can be used to run the uploader without having to install node.js and yarn. It can also be used in a CI/CD pipeline.

### Example usage

#### docker cli

```bash
docker run --rm -v ./:/app/mod -it -e EMAIL='test@mail.com' -e PASSWORD="fakePass" -e MOD_ID="111" pdxmoduploader yarn start
```

#### docker-compose

```yaml
version: "3.8"

services:
  pdxmoduploader:
    image: ghcr.io/the24thds/pdx-mods-stellaris-uploader:latest
    volumes:
        - ./:/app/mod
    environment:
        EMAIL: ""
        PASSWORD: ""
        MOD_ID: ""
```


#### Gitlab CI

`EMAIL` and `PASSWORD` variables are set in the project's CI/CD settings.

```yaml
variables:
  GIT_CLONE_PATH: $CI_BUILDS_DIR/mod
  MOD_ID: "111"

workflow:
  name: 'Upload mod version'
  rules:
    - if: $CI_PIPELINE_SOURCE == "web"
      when: always
    - when: never

stages:
  - PDX Mods

'Prepare and upload':
  image: ghcr.io/the24thds/pdx-mods-stellaris-uploader:latest
  stage: PDX Mods
  before_script:
    - apt update && apt install zip -y
    - cp -r /app/* $CI_BUILDS_DIR
  script:
    - zip -r mod.zip * -x ".*"
    - yarn start
```
