const express = require('express');
const { Webhook } = require('svix');
const router = express.Router();

// Test endpoint to verify webhook is accessible
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    routes: ['GET /api/webhooks/test', 'POST /api/webhooks/clerk']
  });
});

// Debug route to list all available routes
router.get('/', (req, res) => {
  res.json({
    message: 'Webhook routes are loaded',
    availableRoutes: [
      'GET /api/webhooks/',
      'GET /api/webhooks/test',
      'POST /api/webhooks/clerk'
    ],
    timestamp: new Date().toISOString()
  });
});

// Clerk webhook handler
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('🔔 Webhook received at:', new Date().toISOString());
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body length:', req.body?.length || 0);
  
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      console.error('❌ CLERK_WEBHOOK_SECRET is not set');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const headers = req.headers;
    const payload = req.body;

    // Verify the webhook signature
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(payload, headers);
      console.log('✅ Webhook signature verified successfully');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const { type, data } = evt;
    console.log(`🎯 Received Clerk webhook: ${type}`);
    console.log('📄 Event data:', JSON.stringify(data, null, 2));

    switch (type) {
      case 'user.created':
        await handleUserCreated(data, req.prisma);
        break;
      
      case 'user.updated':
        await handleUserUpdated(data, req.prisma);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(data, req.prisma);
        break;
      
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle user creation
async function handleUserCreated(userData, prisma) {
  console.log(`👤 Creating user for Clerk ID: ${userData.id}`);
  
  try {
    const userCreateData = {
      clerkId: userData.id,
      email: userData.email_addresses[0]?.email_address || '',
      username: userData.username || `user_${userData.id.slice(-8)}`,
      firstName: userData.first_name,
      lastName: userData.last_name,
      displayName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || null,
      avatarUrl: userData.image_url,
      emailVerified: userData.email_addresses[0]?.verification?.status === 'verified',
      lastSignInAt: userData.last_sign_in_at ? new Date(userData.last_sign_in_at) : null,
    };
    
    console.log('📝 User data to create:', JSON.stringify(userCreateData, null, 2));
    
    const user = await prisma.user.create({
      data: userCreateData
    });
    
    console.log(`✅ User created in database: ${user.id} (Clerk ID: ${userData.id})`);
  } catch (error) {
    // User might already exist, try to update instead
    if (error.code === 'P2002') {
      console.log(`⚠️ User ${userData.id} already exists, updating...`);
      await handleUserUpdated(userData, prisma);
    } else {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }
}

// Handle user updates
async function handleUserUpdated(userData, prisma) {
  try {
    const user = await prisma.user.upsert({
      where: { clerkId: userData.id },
      update: {
        email: userData.email_addresses[0]?.email_address || '',
        username: userData.username || `user_${userData.id.slice(-8)}`,
        firstName: userData.first_name,
        lastName: userData.last_name,
        displayName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || null,
        avatarUrl: userData.image_url,
        emailVerified: userData.email_addresses[0]?.verification?.status === 'verified',
        lastSignInAt: userData.last_sign_in_at ? new Date(userData.last_sign_in_at) : null,
      },
      create: {
        clerkId: userData.id,
        email: userData.email_addresses[0]?.email_address || '',
        username: userData.username || `user_${userData.id.slice(-8)}`,
        firstName: userData.first_name,
        lastName: userData.last_name,
        displayName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || null,
        avatarUrl: userData.image_url,
        emailVerified: userData.email_addresses[0]?.verification?.status === 'verified',
        lastSignInAt: userData.last_sign_in_at ? new Date(userData.last_sign_in_at) : null,
      }
    });
    
    console.log(`User updated in database: ${user.id}`);
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Handle user deletion
async function handleUserDeleted(userData, prisma) {
  try {
    // Soft delete by setting deletedAt timestamp
    await prisma.user.update({
      where: { clerkId: userData.id },
      data: {
        // Mark posts as deleted
        posts: {
          updateMany: {
            where: {},
            data: { deletedAt: new Date() }
          }
        }
      }
    });

    // Actually delete the user record
    await prisma.user.delete({
      where: { clerkId: userData.id }
    });
    
    console.log(`User deleted from database: ${userData.id}`);
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

module.exports = router;