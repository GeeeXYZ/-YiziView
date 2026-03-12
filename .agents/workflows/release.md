---
description: Bump version, create Git tag, and push remote
---
This workflow helps you quickly release a new version of the application. It leverages npm's built-in versioning to reliably update the package.json, commit, tag, and then pushes to git.

Please ask the user whether they want to do a `patch` (e.g. 0.8.4 -> 0.8.5), `minor` (e.g. 0.8.4 -> 0.9.0), or `major` (e.g. 0.8.4 -> 1.0.0) version bump before executing. Alternatively, they can specify the exact version.

// turbo-all
1. Use `npm version <type>` to automatically bump the version in `package.json`, create a git commit, and generate a Git tag for the new version. You should replace `<type>` with `patch`, `minor`, `major`, or the exact version number like `0.8.5`.
2. Push the new commit and the new tag to the remote repository using `git push --follow-tags`.
3. Inform the user that the new release label has been successfully created and pushed.
