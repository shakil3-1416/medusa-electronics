const c = require("ansi-colors");

const requiredEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    // TODO: we need a good doc to point this to
    description:
      "Learn how to create a publishable key: https://docs.medusajs.com/v2/resources/storefront-development/publishable-api-keys",
  },
];

// Hosted builds (Vercel or any production build) must point at a reachable
// backend rather than silently falling back to localhost.
const isHostedBuild =
  Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production"

if (isHostedBuild) {
  requiredEnvs.push({
    key: "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
    description: "Public URL of the deployed Medusa backend, e.g. https://api.example.com",
  })
}

function checkEnvVariables() {
  const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || ""
  if (
    process.env.VERCEL &&
    /localhost|127\.0\.0\.1/.test(backendUrl)
  ) {
    console.error(
      c.red.bold(
        "\nNEXT_PUBLIC_MEDUSA_BACKEND_URL points at localhost, which a Vercel deployment cannot reach.\n"
      )
    )
    process.exit(1)
  }

  const missingEnvs = requiredEnvs.filter(function (env) {
    c;
    return !process.env[env.key];
  });

  if (missingEnvs.length > 0) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n")
    );

    missingEnvs.forEach(function (env) {
      console.error(c.yellow(`  ${c.bold(env.key)}`));
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`));
      }
    });

    console.error(
      c.yellow(
        "\nPlease set these variables in your .env file or environment before starting the application.\n"
      )
    );

    process.exit(1);
  }
}

module.exports = checkEnvVariables;
