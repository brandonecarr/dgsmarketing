import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@rosie/ui", "@rosie/ai", "@rosie/db", "@rosie/messaging"],
};

export default config;
