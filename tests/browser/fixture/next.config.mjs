import { fileURLToPath } from "node:url";

const nextConfig = {
  agentRules: false,
  webpack(config) {
    config.resolve.alias["@"] = fileURLToPath(
      new URL("../../../", import.meta.url),
    );
    return config;
  },
};

export default nextConfig;
