# Environments

This directory contains environment-specific configuration files for the application.

## Files

- `environment.ts` - Development environment configuration
  - API endpoints
  - WebSocket configuration
  - Debug flags
  - Feature toggles

## Configuration Options

### API Configuration

- `apiUrl` - Backend API base URL
- `wsUrl` - WebSocket server URL

### Feature Flags

- `production` - Production mode flag
- `enableDebug` - Debug mode toggle

## Usage

```typescript
import { environment } from "../environments/environment";

// Access configuration
const apiUrl = environment.apiUrl;
const wsUrl = environment.wsUrl;
```

## Environment Types

- Development (default)

  - Local development server
  - Debug enabled
  - Hot reload
  - Detailed logging

- Production
  - Production API endpoints
  - Optimized builds
  - Minimal logging
  - Security enhancements

## Best Practices

- Never commit sensitive information
- Use environment variables for sensitive data
- Keep environment files in version control
- Document all configuration options
- Use TypeScript interfaces for type safety
