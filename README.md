# Stock News Backend

A Node.js backend application built with Express.js following enterprise architecture practices with proper separation of concerns.

## Architecture

This project follows a layered architecture pattern:

```
src/
├── config/          # Configuration management
├── controllers/     # HTTP request/response handling
├── services/        # Business logic layer
├── models/          # Data models
├── routes/          # Route definitions
├── middleware/      # Express middleware
└── helpers/         # Utility functions
```

## Features

- ✅ Separation of concerns (Controllers, Services, Helpers)
- ✅ Middleware for error handling and logging
- ✅ Request validation using express-validator
- ✅ Security headers with Helmet
- ✅ CORS configuration
- ✅ Environment-based configuration
- ✅ Standardized API responses
- ✅ Health check endpoint

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration

### Running the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## API Endpoints

### Health Check
```
GET /api/v1/health
```

### Example Endpoints
```
GET    /api/v1/examples          # Get all examples
GET    /api/v1/examples/:id      # Get example by ID
POST   /api/v1/examples          # Create new example
```

## Project Structure

- **Controllers**: Handle HTTP requests, validate input, call services, and format responses
- **Services**: Contain business logic, independent of HTTP layer
- **Models**: Define data structures and validation
- **Routes**: Define API endpoints and validation rules
- **Middleware**: Cross-cutting concerns (error handling, logging, etc.)
- **Helpers**: Reusable utility functions
- **Config**: Application configuration management

## Development

### Adding New Features

1. **Create a Model** (if needed): `src/models/YourModel.js`
2. **Create a Service**: `src/services/yourService.js` (business logic)
3. **Create a Controller**: `src/controllers/yourController.js` (HTTP handling)
4. **Create Routes**: `src/routes/yourRoutes.js` (endpoint definitions)
5. **Register Routes**: Add to `src/routes/index.js`

## Environment Variables

See `.env.example` for available configuration options:
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `API_VERSION`: API version prefix
- `CORS_ORIGIN`: Allowed CORS origin

## License

ISC

