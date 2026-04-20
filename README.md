# Description

This is a simple Playwright test that can be used to upload a Stellaris mod to the PDX Mods.

This could potentially be used for other games as well, but I have not tested it.

# Available environment variables

| Variable           | Description                                              | Default value                |
| ------------------ | -------------------------------------------------------- | ---------------------------- |
| `USERNAME`         | The username to check for in the top right corner        | -                            |
| `EMAIL`            | The email to use for logging in                          | —                            |
| `PASSWORD`         | The password to use for logging in                       | —                            |
| `MOD_FOLDER_PATH`  | The path towards the mod folder relative to `__dirname`  | `${__dirname}/mod`           |
| `MOD_ARCHIVE_PATH` | The path towards the mod archive relative to `__dirname` | `${__dirname}/mod.zip`       |
| `MOD_ID`           | The ID of the mod on PDX Mods                            | —                            |
| `MOD_VERSION`      | The version of the mod                                   | parsed from `descriptor.mod` |
| `GAME_VERSION`     | The version of the game the mod is compatible with       | parsed from `descriptor.mod` |
| `UPLOAD_TIMEOUT`   | The timeout for the upload in milliseconds               | `60_000 * 20` (20 mins)      |
| `RELEASE_NOTES`    | The release notes to use when submitting the new version | `No release notes provided.` |

# Usage

## Directly

### Requirements

- node.js v22.21+
- yarn v1.22+

### Steps

1. Clone the repository
2. Run `yarn install`
3. Copy `.env.example` to `.env` and fill in your values (`USERNAME`, `EMAIL`, `PASSWORD` and `MOD_ID` are required, see [Available environment variables](#available-environment-variables)). Note: do not quote values in `.env` (e.g. `EMAIL=foo@bar.com`, not `EMAIL="foo@bar.com"`)
4. Run `yarn auth` to authenticate and save the session to `.auth/user.json`
5. Run `yarn start` to upload the mod

## Docker image

A docker image is built every time a new tag is pushed to the repository (`ghcr.io/the24thds/pdx-mods-stellaris-uploader`). You can see the available tags on the [package page](https://github.com/The24thDS/pdx-mods-stellaris-uploader/pkgs/container/pdx-mods-stellaris-uploader).

This image can be used to run the uploader without having to install node.js and yarn. It can also be used in a CI/CD pipeline.

### Example usage

#### docker cli

1. You will need to authenticate and save the cookies file first
  ```bash
  docker run --rm -v ./:/app/mod -it --env-file .env pdxmoduploader yarn auth
  ```
2. Now you can run the upload command
  ```bash
  docker run --rm -v ./:/app/mod -it --env-file .env pdxmoduploader yarn start
  ```

#### docker-compose

The compose setup keeps the container running so you can exec into it to run `yarn auth` and `yarn start` interactively.

```yaml
services:
  pdxmoduploader:
    image: ghcr.io/the24thds/pdx-mods-stellaris-uploader:latest
    volumes:
      - ./:/app/mod
    env_file: .env
    entrypoint: tail -f /dev/null
```

Then exec in with:

```bash
docker compose exec pdxmoduploader bash
```

#### Gitlab CI

`USERNAME`, `EMAIL`, and `PASSWORD` variables are set in the project's CI/CD settings.

Authentication requires a saved session file. Run `yarn auth` on your local machine first to generate `.auth/user.json`, then store its contents as a CI/CD file variable named `AUTH_SESSION`. The example below writes it back to the expected path before running the upload.

```yaml
variables:
  GIT_CLONE_PATH: $CI_BUILDS_DIR/mod
  MOD_ID: '111'

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
    - mkdir -p $CI_BUILDS_DIR/.auth && cp $AUTH_SESSION $CI_BUILDS_DIR/.auth/user.json
  script:
    - zip -r mod.zip * -x ".*"
    - yarn start
```
