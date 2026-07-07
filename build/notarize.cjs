const { notarize } = require("@electron/notarize");
const path = require("path");

exports.default = async function notarizeMac(context) {
  if (process.platform !== "darwin") return;

  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== "darwin") return;

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;
  const keychainProfile = process.env.APPLE_NOTARY_KEYCHAIN_PROFILE;

  if (!keychainProfile && (!appleApiKey || !appleApiKeyId || !appleApiIssuer)) {
    console.log("Skipping notarization: set APPLE_NOTARY_KEYCHAIN_PROFILE or APPLE_API_KEY/APPLE_API_KEY_ID/APPLE_API_ISSUER.");
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}`);
  const options = {
    appBundleId: packager.appInfo.appId,
    appPath
  };

  if (keychainProfile) {
    options.keychainProfile = keychainProfile;
  } else {
    options.appleApiKey = appleApiKey;
    options.appleApiKeyId = appleApiKeyId;
    options.appleApiIssuer = appleApiIssuer;
  }

  await notarize(options);
};
