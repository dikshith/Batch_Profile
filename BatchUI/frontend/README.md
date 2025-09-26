# Windows Scripts Dashboard

A web-based dashboard for managing and executing Windows scripts (PowerShell, Batch, and Bash) with real-time monitoring and execution history.

## Project Structure

- `/src` - Frontend Angular application
  - `/app` - Main application code
    - `/components` - Reusable UI components
    - `/services` - Business logic and API communication
    - `/guards` - Route protection and authentication
    - `/interceptors` - HTTP request/response handling
  - `/environments` - Environment configuration
- `/server` - Backend Node.js server
- `/public` - Static assets


### Windows Service

1. Start the windows Serivce

   ```bash
   npm run start:service
   ```

2. Stop if needed

```bash
  npm run stop:service
```

The application will be available at `http://localhost:4200`
