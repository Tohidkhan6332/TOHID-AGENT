module.exports = {
  apps: [{
    name: "tohid-agent",
    script: "app.js",
    interpreter: "node",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    watch: false,
    max_memory_restart: "700M",
    kill_timeout: 10000,
    listen_timeout: 15000,
    env: {
      NODE_ENV: "production"
    }
  }]
};
