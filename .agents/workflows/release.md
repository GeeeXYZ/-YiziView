---
description: Bump version, create Git tag, and push remote
---
This workflow helps you quickly release a new version of the application. It leverages npm's built-in versioning to reliably update the package.json, commit, tag, and then pushes to git.

Please ask the user whether they want to do a `patch` (e.g. 0.8.4 -> 0.8.5), `minor` (e.g. 0.8.4 -> 0.9.0), or `major` (e.g. 0.8.4 -> 1.0.0) version bump before executing. Alternatively, they can specify the exact version.

// turbo-all
1. Use `git log $(git describe --tags --abbrev=0)..HEAD --oneline` (if a previous tag exists) to find the latest changes. 
2. Generate a "Minimal Release Log" (极简 update log) based on these changes, where each new feature or fix is described in a single short sentence.
3. Prepend or append this minimal release log into a `CHANGELOG.md` file at the root of the project (create the file if it does not exist) with the target version number as a heading.
4. Stage the files with `git add .` and commit them with a message like `git commit -m "docs: generate changelog"`.
5. Use `npm version <type>` to automatically bump the version in `package.json`, create a release commit, and generate a Git tag. You should replace `<type>` with `patch`, `minor`, `major`, or the specified exact version. (Ensure commands are separated by `;` if chaining in PowerShell).
6. Push the new commit and the new tag to the remote repository using `git push --follow-tags`.
7. Inform the user that the new release has been successfully pushed and present the minimal update log to them.
