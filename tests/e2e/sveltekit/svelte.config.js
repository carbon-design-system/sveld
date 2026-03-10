import adapter from "@sveltejs/adapter-static";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    prerender: {
      handleHttpError: ({ path, message }) => {
        if (path === "/favicon.png" && message.includes("404")) return;
        throw new Error(message);
      },
    },
  },
};

export default config;
