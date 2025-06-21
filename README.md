# Naksh Server

A comprehensive REST API server for the Naksh social media platform built with Express.js and Prisma.

## Features

- **User Management**: Registration, profiles, suspension
- **Posts**: Create, update, delete posts with media support
- **Comments**: Threaded commenting system
- **Reactions**: Multiple reaction types (like, love, angry, etc.)
- **Social Features**: Follow/unfollow users
- **Real-time Chat**: Direct messages and group chats
- **Moderation**: Content reporting and moderation system
- **Push Notifications**: Device token management
- **Anonymous Posts**: Support for anonymous posting

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **CORS** - Cross-origin resource sharing

## Project Structure

```
server/
├── routes/
│   ├── users.js          # User management endpoints
│   ├── posts.js          # Post management endpoints
│   ├── comments.js       # Comment system endpoints
│   ├── reactions.js      # Reaction system endpoints
│   ├── follows.js        # Follow system endpoints
│   ├── chats.js          # Chat management endpoints
│   ├── messages.js       # Message system endpoints
│   ├── moderation.js     # Content moderation endpoints
│   └── deviceTokens.js   # Push notification tokens
├── prisma/
│   └── schema.prisma     # Database schema
├── index.js              # Main server file
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the server directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/naksh"
   PORT=3000
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Or run migrations (if you have migration files)
   npm run db:migrate
   ```

## Running the Server

### Development Mode
```bash
npm run dev
```
This starts the server with nodemon for auto-reloading.

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## Available Scripts

- `npm start` - Start the server in production mode
- `npm run dev` - Start the server in development mode with auto-reload
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Main API Routes
- `GET /api/users` - User management
- `GET /api/posts` - Post management
- `GET /api/comments` - Comment system
- `GET /api/reactions` - Reaction system
- `GET /api/follows` - Follow system
- `GET /api/chats` - Chat management
- `GET /api/messages` - Message system
- `GET /api/moderation` - Content moderation
- `GET /api/device-tokens` - Push notification tokens

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

## Database Schema

The database schema includes the following main entities:

- **Users** - User accounts and profiles
- **Posts** - User posts with media support
- **Comments** - Threaded comments on posts
- **Reactions** - User reactions to posts
- **Follows** - User follow relationships
- **Chats** - Chat rooms (direct and group)
- **Messages** - Chat messages
- **ModerationFlags** - Content reports
- **DeviceTokens** - Push notification tokens
- **AnonymousPosts** - Anonymous post data

## Key Features

### Posts System
- Support for text, images, and videos
- Location tagging
- Visibility controls (public, private, followers)
- Post expiration (24-hour default)
- Post boosting
- Anonymous posting

### Social Features
- User following/followers
- Personalized feeds
- Trending posts
- Follow suggestions

### Chat System
- Direct messages
- Group chats
- Message delivery and read receipts
- Unread message counts

### Moderation
- Content reporting
- Moderation queue
- User suspension
- Content flagging

### Push Notifications
- Device token registration
- Platform-specific tokens (iOS/Android)
- Token validation and cleanup

## Error Handling

The API uses consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error

## Security Considerations

⚠️ **Important**: This server currently does not implement authentication middleware. For production use, you should add:

1. **Authentication** - JWT or session-based auth
2. **Authorization** - Role-based access control
3. **Rate Limiting** - Prevent API abuse
4. **Input Validation** - Sanitize user inputs
5. **CORS Configuration** - Restrict origins in production
6. **HTTPS** - Use SSL/TLS encryption
7. **Environment Variables** - Secure sensitive data

## Development

### Adding New Routes
1. Create a new route file in the `routes/` directory
2. Import and use it in `index.js`
3. Follow the existing pattern for error handling and response formatting

### Database Changes
1. Update the Prisma schema in `prisma/schema.prisma`
2. Run `npm run db:push` to apply changes
3. Run `npm run db:generate` to update the Prisma client

### Testing
Currently, no tests are implemented. Consider adding:
- Unit tests for route handlers
- Integration tests for API endpoints
- Database tests with test fixtures

## Deployment

For production deployment:

1. Set up a PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Start the server with `npm start`
5. Set up a reverse proxy (nginx)
6. Configure SSL certificates
7. Set up monitoring and logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Add your license information here]

## Support

For questions or issues, please [create an issue](link-to-issues) in the repository.