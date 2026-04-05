---
description: Bump version, create Git tag, and push remote
---
This workflow helps you quickly release a new version of the application. It leverages npm's built-in versioning to reliably update the package.json, commit, tag, and then pushes to git.

Please ask the user whether they want to do a `patch` (e.g. 0.8.4 -> 0.8.5), `minor` (e.g. 0.8.4 -> 0.9.0), or `major` (e.g. 0.8.4 -> 1.0.0) version bump before executing. Alternatively, they can specify the exact version.

// turbo-all
1. Use `git log $(git describe --tags --abbrev=0)..HEAD --oneline` (if a previous tag exists) to find the latest changes. 
2. Conceptualize the latest changes and generate a comprehensive "Bilingual Release Log" (中英双语 Update Log). Do NOT mix English and Chinese line-by-line. Instead, write the entire log cleanly in English first, grouped into logical categories like "✨ New Features", "🎨 UX & Interactions", and "🐛 Bug Fixes". Then, add a separator and write the entire translated log fully in Chinese below it.
3. Prepend this new clean bilingual release log into `CHANGELOG.md` at the root of the project with the target version number as a heading (e.g., `## v0.9.0 - The Great Update`). Create the file if it does not exist.
4. Stage the files with `git add .` and commit them with a message like `git commit -m "docs: append bilingual changelog"`.
5. Use `npm version <type>` to automatically bump the version in `package.json`, create a release commit, and generate a Git tag. Replace `<type>` with `patch`, `minor`, `major`, or the specified exact version.
6. Push the new commit and the new tag to the remote repository using `git push --follow-tags`.
7. Output the generated cleanly separated bilingual Release Log in the chat in an easy-to-copy Markdown format.
8. Attempt to automatically publish this release to GitHub by using the GitHub CLI. Execute `gh release create v<VERSION> --title "Release v<VERSION>" --notes-file CHANGELOG.md_temp`. (You should save the specific log for this version into a temporary file, pass it to `gh release`, and then delete the temp file). If the `gh` command is not installed or fails, instruct the user to copy the outputted log and paste it manually into the GitHub Releases page.
