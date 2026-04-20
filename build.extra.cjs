const pkg = require('./package.json');

module.exports = {
  ...pkg.build,
  extraResources: [
    {
      from: "plugins",
      to: "plugins",
      filter: [
        "**/*",
        "!**/node_modules",
        "!**/.env",
        "!**/scripts",
        "!**/package.json",
        "!**/package-lock.json"
      ]
    }
  ]
};
