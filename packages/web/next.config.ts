import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@civic-intel/core", "@civic-intel/pretext-civic"],
	basePath: "/CivicIntel",
	output: "export",
	trailingSlash: true,
	images: {
		unoptimized: true,
	},
};

export default nextConfig;
