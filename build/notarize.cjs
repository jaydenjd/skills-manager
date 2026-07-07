const { notarize } = require("@electron/notarize");
const path = require("path");

exports.default = async function notarizeMac(context) {
  if (process.platform !== "darwin") return;

  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== "darwin") return;

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
    console.log("Skipping notarization: APPLE_API_KEY, APPLE_API_KEY_ID, or APPLE_API_ISSUER is not set.");
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}`);
  await notarize({
    appBundleId: packager.appInfo.appId,
    appPath,
    appleApiKey,
    appleApiKeyId,
    appleApiIssuer
  });
};
