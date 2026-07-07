const { execFileSync } = require("child_process");
const path = require("path");

function run(command, args) {
  console.log([command, ...args].join(" "));
  execFileSync(command, args, { stdio: "inherit" });
}

function signingIdentity() {
  const name = process.env.CSC_NAME || "JUNDE WU (A8DZ968K75)";
  return name.startsWith("Developer ID Application:")
    ? name
    : `Developer ID Application: ${name}`;
}

function notaryArgs(file) {
  if (process.env.APPLE_NOTARY_KEYCHAIN_PROFILE) {
    return ["notarytool", "submit", file, "--keychain-profile", process.env.APPLE_NOTARY_KEYCHAIN_PROFILE, "--wait"];
  }
  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) {
    return [
      "notarytool",
      "submit",
      file,
      "--key",
      process.env.APPLE_API_KEY,
      "--key-id",
      process.env.APPLE_API_KEY_ID,
      "--issuer",
      process.env.APPLE_API_ISSUER,
      "--wait"
    ];
  }
  return null;
}

exports.default = async function notarizeDmg(context) {
  if (process.platform !== "darwin") return [];

  const argsForNotary = [];
  const dmgFiles = (context.artifactPaths || []).filter((file) => file.endsWith(".dmg"));
  if (!dmgFiles.length) return [];

  for (const dmgPath of dmgFiles) {
    const fullPath = path.resolve(dmgPath);
    run("codesign", ["--force", "--sign", signingIdentity(), fullPath]);

    const args = notaryArgs(fullPath);
    if (!args) {
      console.log("Skipping DMG notarization: set APPLE_NOTARY_KEYCHAIN_PROFILE or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER.");
      continue;
    }
    argsForNotary.push(fullPath);
    run("xcrun", args);
    run("xcrun", ["stapler", "staple", fullPath]);
  }

  if (argsForNotary.length) {
    console.log(`Notarized DMG artifacts: ${argsForNotary.join(", ")}`);
  }
  return [];
};
