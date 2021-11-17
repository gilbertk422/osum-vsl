module.exports = {
  apps: [
    {
      name: 'osum-vsl',
      script: 'dist/main.js',
      exec_mode: 'cluster',
      instances: 3,
      autorestart: true,
      watch: ['src'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
