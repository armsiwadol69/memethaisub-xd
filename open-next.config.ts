import cache from "@opennextjs/cloudflare/kv-cache";

const config = {
    default: {
        runtime: "edge",
        plugins: [cache],
    },
};

export default config;