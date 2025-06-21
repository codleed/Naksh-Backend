# Error Handling System Guide

This guide explains how to use the new centralized error handling system in the Naksh API.

## Overview

The error handling system provides:
- **Consistent error responses** across all endpoints
- **Automatic error transformation** from various sources (Prisma, Clerk, Cloudinary, etc.)
- **Centralized error logging** and monitoring
- **Type-safe error classes** for different error scenarios
- **Validation utilities** for common input validation
- **Response helpers** for consistent API responses

## Core Components

### 1. Error Classes (`utils/errors.js`)

Custom error classes that extend the base `APIError` class:

```javascript
const { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError, 
  ConflictError, 
  GoneError, 
  RateLimitError, 
  DatabaseError, 
  ExternalServiceError 
} = require('../utils/errors');

// Usage examples
throw new ValidationError('Invalid email format');
throw new NotFoundError('User');
throw new ConflictError('Username already taken');
throw new AuthenticationError(); // Uses default message
```

### 2. Async Handler (`utils/asyncHandler.js`)

Wraps async functions to automatically catch and transform errors:

```javascript
const { asyncHandler } = require('../utils/asyncHandler');

// Wrap individual functions
const getUser = asyncHandler(async (req, res) => {
  // Any thrown error will be automatically caught and transformed
  const user = await req.prisma.user.findUnique({
    where: { id: req.params.id }
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  res.success(user);
});

// Wrap entire controller
const { wrapAllMethods } = require('../utils/asyncHandler');
module.exports = wrapAllMethods({
  getUser,
  createUser,
  updateUser
});
```

### 3. Validation Utilities (`utils/validation.js`)

Common validation functions that throw `ValidationError` on failure:

```javascript
const { 
  validateRequired, 
  validateEmail, 
  validateUsername, 
  validatePagination,
  validateEnum,
  validationSchemas 
} = require('../utils/validation');

// Usage in controllers
const createUser = asyncHandler(async (req, res) => {
  const { username, email, bio } = req.body;
  
  // Validate required fields
  validateRequired(req.body, ['username', 'email']);
  
  // Validate specific formats
  validateUsername(username);
  validateEmail(email);
  
  // Validate string length
  if (bio) {
    validateStringLength(bio, 'bio', { maxLength: 500 });
  }
  
  // ... rest of the logic
});

// Use predefined validation schemas
const createPost = asyncHandler(async (req, res) => {
  validationSchemas.createPost(req.body);
  // ... rest of the logic
});
```

### 4. Response Helpers (`utils/response.js`)

Consistent response formatting:

```javascript
// Available through middleware on res object
res.success(data, message, statusCode);
res.created(data, message);
res.noContent(message);
res.paginated(data, pagination, message);
res.notFound(resource, message);
res.unauthorized(message);
res.forbidden(message);
res.conflict(message, details);
res.validationError(errors, message);

// Usage examples
res.success(user, 'User retrieved successfully');
res.created(post, 'Post created successfully');
res.paginated(posts, { page: 1, limit: 10, total: 100 });
res.notFound('User');
```

## Migration Guide

### Step 1: Update Controller Functions

**Before:**
```javascript
const getUser = async (req, res) => {
  try {
    const user = await req.prisma.user.findUnique({
      where: { id: req.params.id }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};
```

**After:**
```javascript
const getUser = asyncHandler(async (req, res) => {
  const user = await req.prisma.user.findUnique({
    where: { id: req.params.id }
  });
  
  if (!user) {
    throw new NotFoundError('User');
  }
  
  res.success(user, 'User retrieved successfully');
});
```

### Step 2: Add Input Validation

**Before:**
```javascript
const createUser = async (req, res) => {
  try {
    const { username, email } = req.body;
    
    if (!username || !email) {
      return res.status(400).json({ error: 'Username and email are required' });
    }
    
    // ... rest of logic
  } catch (error) {
    // ... error handling
  }
};
```

**After:**
```javascript
const createUser = asyncHandler(async (req, res) => {
  const { username, email, bio } = req.body;
  
  // Validation throws ValidationError automatically
  validateRequired(req.body, ['username', 'email']);
  validateUsername(username);
  validateEmail(email);
  
  if (bio) {
    validateStringLength(bio, 'bio', { maxLength: 500 });
  }
  
  // ... rest of logic
  res.created(user, 'User created successfully');
});
```

### Step 3: Handle Prisma Errors

**Before:**
```javascript
try {
  const user = await req.prisma.user.create({ data });
} catch (error) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'Username already exists' });
  }
  res.status(500).json({ error: 'Failed to create user' });
}
```

**After:**
```javascript
// Prisma errors are automatically transformed by the error handler
const user = await req.prisma.user.create({ data });
res.created(user, 'User created successfully');
```

## Error Response Format

All errors now follow a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND_ERROR",
    "statusCode": 404,
    "details": {
      "field": "id",
      "value": "invalid-id"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Success responses:

```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": "123",
    "username": "john_doe"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

Paginated responses:

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Best Practices

### 1. Use Specific Error Types

```javascript
// Good
throw new NotFoundError('User');
throw new ConflictError('Username already taken');
throw new ValidationError('Invalid email format');

// Avoid generic errors
throw new Error('Something went wrong');
```

### 2. Provide Meaningful Error Messages

```javascript
// Good
throw new ValidationError('Password must be at least 8 characters long');

// Less helpful
throw new ValidationError('Invalid password');
```

### 3. Include Error Details When Helpful

```javascript
throw new ValidationError('Validation failed', {
  fields: [
    { field: 'email', message: 'Invalid email format' },
    { field: 'username', message: 'Username too short' }
  ]
});
```

### 4. Use Transactions for Data Consistency

```javascript
const deleteUser = asyncHandler(async (req, res) => {
  await req.prisma.$transaction(async (prisma) => {
    await prisma.post.updateMany({
      where: { authorId: req.params.id },
      data: { deletedAt: new Date() }
    });
    
    await prisma.user.delete({
      where: { id: req.params.id }
    });
  });
  
  res.noContent('User deleted successfully');
});
```

### 5. Validate Early and Often

```javascript
const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { caption, visibility } = req.body;
  
  // Validate ID format
  validateUUID(id);
  
  // Validate enum values
  if (visibility) {
    validateEnum(visibility, ['PUBLIC', 'PRIVATE', 'FOLLOWERS'], 'visibility');
  }
  
  // Validate string length
  if (caption) {
    validateStringLength(caption, 'caption', { maxLength: 2000 });
  }
  
  // ... rest of logic
});
```

## Testing Error Handling

```javascript
// Test that errors are properly thrown
describe('User Controller', () => {
  it('should throw NotFoundError when user does not exist', async () => {
    const req = { params: { id: 'non-existent-id' } };
    const res = {};
    
    await expect(getUser(req, res)).rejects.toThrow(NotFoundError);
  });
  
  it('should throw ValidationError for invalid email', async () => {
    const req = { body: { email: 'invalid-email' } };
    const res = {};
    
    await expect(createUser(req, res)).rejects.toThrow(ValidationError);
  });
});
```

## Monitoring and Logging

The error handler automatically logs errors with context:

```javascript
// Error logs include:
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "method": "POST",
  "url": "/api/users",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "userId": "user_123",
  "error": {
    "name": "ValidationError",
    "message": "Invalid email format",
    "code": "VALIDATION_ERROR",
    "statusCode": 400,
    "stack": "..."
  }
}
```

For production, consider integrating with services like:
- **Sentry** for error tracking
- **Winston** for structured logging
- **CloudWatch** for AWS deployments
- **DataDog** for monitoring

## Environment-Specific Behavior

### Development
- Full error details including stack traces
- Detailed logging to console
- All error information exposed to client

### Production
- Only operational errors sent to client
- Generic messages for programming errors
- Sensitive information filtered out
- Errors logged for monitoring

## Common Error Scenarios

### Authentication
```javascript
// Check if user is authenticated
if (!req.auth?.userId) {
  throw new AuthenticationError();
}

// Check if user has permission
if (post.authorId !== req.auth.userId) {
  throw new AuthorizationError('Cannot modify this post');
}
```

### Resource Validation
```javascript
// Check if resource exists
const post = await req.prisma.post.findUnique({
  where: { id: req.params.id }
});

if (!post) {
  throw new NotFoundError('Post');
}

// Check if resource is accessible
if (post.expiresAt < new Date()) {
  throw new GoneError('Post has expired');
}
```

### Input Validation
```javascript
// Use validation schemas for complex validation
validationSchemas.createPost(req.body);

// Or individual validators
validateRequired(req.body, ['title', 'content']);
validateStringLength(req.body.title, 'title', { minLength: 1, maxLength: 100 });
validateEnum(req.body.status, ['DRAFT', 'PUBLISHED'], 'status');
```

This error handling system makes your API more robust, maintainable, and user-friendly while reducing boilerplate code in controllers.