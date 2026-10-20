export default {
  async fetch(request, env) {
    // Automatically serve static assets from the public directory
    return env.ASSETS.fetch(request);
  },
};
