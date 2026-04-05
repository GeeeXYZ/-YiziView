---
description: Bump version, create Git tag, and push remote
---
This workflow helps you quickly release a new version of the application. It leverages npm's built-in versioning to reliably update the package.json, commit, tag, and then pushes to git.

Please ask the user whether they want to do a `patch` (e.g. 0.8.4 -> 0.8.5), `minor` (e.g. 0.8.4 -> 0.9.0), or `major` (e.g. 0.8.4 -> 1.0.0) version bump before executing. Alternatively, they can specify the exact version.

// turbo-all
1. Use `git log $(git describe --tags --abbrev=0)..HEAD --oneline` (if a previous tag exists) to find the latest changes. 
2. Generate an **ultra-concise bilingual changelog**. Rules:
   - Each change is a single short line, NO bold, NO sub-descriptions. Max ~6-8 lines total per language.
   - Group under minimal emoji headers: `✨ Features`, `🐛 Fixes`, `⚡ Perf`, `🧹 Cleanup` (only include headers that have entries).
   - English block first, then `---` separator, then Chinese block.
   - Example line format: `- Fix expanded folders not persisting to disk`
3. Prepend this new changelog into `CHANGELOG.md` at the root of the project with the target version number as a heading (e.g., `## v0.9.1`). Create the file if it does not exist.
4. Stage the files with `git add .` and commit them with a message like `git commit -m "docs: changelog vX.Y.Z"`.
5. Use `npm version <type>` to automatically bump the version in `package.json`, create a release commit, and generate a Git tag. Replace `<type>` with `patch`, `minor`, `major`, or the specified exact version.
6. Push the new commit and the new tag to the remote repository using `git push --follow-tags`.
7. Publish the release to GitHub using `gh release create v<VERSION> --title "v<VERSION>" --notes-file CHANGELOG_temp.md` (save only the new version's log to a temp file, use it, then delete it). If `gh` fails (not installed or not authed), print a warning and provide the log for manual pasting.
8. Output the generated concise bilingual Release Log in chat.
