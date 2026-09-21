module.exports = {
  apps: [
    {
      name: "athreya-backend",
      script: "index.js",
      instances: 1, // Or 'max' with Redis enabled
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PROCESS_ROLE: "all",
        PORT: 7000,
        TRUST_PROXY: "true",
      },
      env_file: ".env",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
