/**
 * Webhook Controller
 * Handles webhook registration, management, and event processing
 */

const crypto = require('crypto');
const axios = require('axios');

// In-memory storage for webhooks (in production, this should be in a database)
// You may want to add webhook models to your Prisma schema for persistence
let webhooks = new Map();
let webhookDeliveries = new Map();

/**
 * Generate webhook signature for security
 */
const generateSignature = (payload, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
};

/**
 * Verify webhook signature
 */
const verifySignature = (payload, signature, secret) => {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

/**
 * Register a new webhook
 * POST /api/webhooks
 */
const registerWebhook = async (req, res) => {
  try {
    const { url, events, description, secret } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Validate required fields
    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ 
        error: 'URL and events array are required' 
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Validate events
    const validEvents = [
      'user.created',
      'user.updated',
      'user.deleted',
      'post.created',
      'post.updated',
      'post.deleted',
      'comment.created',
      'comment.updated',
      'comment.deleted',
      'reaction.created',
      'reaction.deleted',
      'follow.created',
      'follow.deleted',
      'message.created',
      'moderation.flag_created',
      'moderation.flag_updated'
    ];

    const invalidEvents = events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ 
        error: `Invalid events: ${invalidEvents.join(', ')}`,
        validEvents 
      });
    }

    // Generate webhook ID and secret if not provided
    const webhookId = crypto.randomUUID();
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    const webhook = {
      id: webhookId,
      userId,
      url,
      events,
      description: description || '',
      secret: webhookSecret,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deliveryCount: 0,
      lastDeliveryAt: null,
      lastDeliveryStatus: null
    };

    webhooks.set(webhookId, webhook);

    // Test webhook connectivity (optional)
    const testPayload = {
      event: 'webhook.test',
      webhook_id: webhookId,
      timestamp: new Date().toISOString(),
      data: {
        message: 'Webhook registration successful'
      }
    };

    try {
      await deliverWebhook(webhook, testPayload);
    } catch (error) {
      console.warn('Webhook test delivery failed:', error.message);
    }

    res.status(201).json({
      message: 'Webhook registered successfully',
      webhook: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        active: webhook.active,
        createdAt: webhook.createdAt
      }
    });
  } catch (error) {
    console.error('Error registering webhook:', error);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
};

/**
 * Get all webhooks for the authenticated user
 * GET /api/webhooks
 */
const getWebhooks = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userWebhooks = Array.from(webhooks.values())
      .filter(webhook => webhook.userId === userId)
      .map(webhook => ({
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        description: webhook.description,
        active: webhook.active,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
        deliveryCount: webhook.deliveryCount,
        lastDeliveryAt: webhook.lastDeliveryAt,
        lastDeliveryStatus: webhook.lastDeliveryStatus
      }));

    res.json({
      webhooks: userWebhooks,
      total: userWebhooks.length
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
};

/**
 * Get webhook by ID
 * GET /api/webhooks/:id
 */
const getWebhookById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const webhook = webhooks.get(id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      description: webhook.description,
      active: webhook.active,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      deliveryCount: webhook.deliveryCount,
      lastDeliveryAt: webhook.lastDeliveryAt,
      lastDeliveryStatus: webhook.lastDeliveryStatus
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
};

/**
 * Update webhook
 * PUT /api/webhooks/:id
 */
const updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, events, description, active } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const webhook = webhooks.get(id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: 'Events must be a non-empty array' });
      }

      const validEvents = [
        'user.created', 'user.updated', 'user.deleted',
        'post.created', 'post.updated', 'post.deleted',
        'comment.created', 'comment.updated', 'comment.deleted',
        'reaction.created', 'reaction.deleted',
        'follow.created', 'follow.deleted',
        'message.created',
        'moderation.flag_created', 'moderation.flag_updated'
      ];

      const invalidEvents = events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        return res.status(400).json({ 
          error: `Invalid events: ${invalidEvents.join(', ')}` 
        });
      }
    }

    // Update webhook
    const updatedWebhook = {
      ...webhook,
      url: url || webhook.url,
      events: events || webhook.events,
      description: description !== undefined ? description : webhook.description,
      active: active !== undefined ? active : webhook.active,
      updatedAt: new Date()
    };

    webhooks.set(id, updatedWebhook);

    res.json({
      message: 'Webhook updated successfully',
      webhook: {
        id: updatedWebhook.id,
        url: updatedWebhook.url,
        events: updatedWebhook.events,
        description: updatedWebhook.description,
        active: updatedWebhook.active,
        updatedAt: updatedWebhook.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
};

/**
 * Delete webhook
 * DELETE /api/webhooks/:id
 */
const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const webhook = webhooks.get(id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    webhooks.delete(id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
};

/**
 * Test webhook delivery
 * POST /api/webhooks/:id/test
 */
const testWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const webhook = webhooks.get(id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const testPayload = {
      event: 'webhook.test',
      webhook_id: id,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        user_id: userId
      }
    };

    try {
      const delivery = await deliverWebhook(webhook, testPayload);
      res.json({
        message: 'Test webhook delivered successfully',
        delivery: {
          id: delivery.id,
          status: delivery.status,
          response_code: delivery.responseCode,
          delivered_at: delivery.deliveredAt
        }
      });
    } catch (error) {
      res.status(400).json({
        message: 'Test webhook delivery failed',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
};

/**
 * Get webhook deliveries
 * GET /api/webhooks/:id/deliveries
 */
const getWebhookDeliveries = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const webhook = webhooks.get(id);

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    if (webhook.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const allDeliveries = Array.from(webhookDeliveries.values())
      .filter(delivery => delivery.webhookId === id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const skip = (page - 1) * limit;
    const deliveries = allDeliveries.slice(skip, skip + parseInt(limit));

    res.json({
      deliveries: deliveries.map(delivery => ({
        id: delivery.id,
        event: delivery.event,
        status: delivery.status,
        response_code: delivery.responseCode,
        response_body: delivery.responseBody,
        error_message: delivery.errorMessage,
        attempt_count: delivery.attemptCount,
        created_at: delivery.createdAt,
        delivered_at: delivery.deliveredAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allDeliveries.length,
        pages: Math.ceil(allDeliveries.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
};

/**
 * Deliver webhook payload
 */
const deliverWebhook = async (webhook, payload) => {
  const deliveryId = crypto.randomUUID();
  const signature = generateSignature(payload, webhook.secret);

  const delivery = {
    id: deliveryId,
    webhookId: webhook.id,
    event: payload.event,
    payload,
    status: 'pending',
    attemptCount: 0,
    createdAt: new Date(),
    deliveredAt: null,
    responseCode: null,
    responseBody: null,
    errorMessage: null
  };

  webhookDeliveries.set(deliveryId, delivery);

  const maxRetries = 3;
  const retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      delivery.attemptCount = attempt + 1;

      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-ID': webhook.id,
          'X-Webhook-Event': payload.event,
          'User-Agent': 'Naksh-Webhooks/1.0'
        },
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Success
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
      delivery.responseCode = response.status;
      delivery.responseBody = response.data;

      // Update webhook stats
      webhook.deliveryCount++;
      webhook.lastDeliveryAt = new Date();
      webhook.lastDeliveryStatus = 'success';

      webhookDeliveries.set(deliveryId, delivery);
      webhooks.set(webhook.id, webhook);

      return delivery;
    } catch (error) {
      delivery.errorMessage = error.message;
      delivery.responseCode = error.response?.status || null;
      delivery.responseBody = error.response?.data || null;

      if (attempt === maxRetries - 1) {
        // Final attempt failed
        delivery.status = 'failed';
        webhook.lastDeliveryStatus = 'failed';
      } else {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }
  }

  // Update webhook stats for failed delivery
  webhook.lastDeliveryAt = new Date();
  webhooks.set(webhook.id, webhook);
  webhookDeliveries.set(deliveryId, delivery);

  throw new Error(`Webhook delivery failed after ${maxRetries} attempts`);
};

/**
 * Trigger webhook for specific events
 * This function should be called from other parts of your application
 */
const triggerWebhook = async (event, data) => {
  try {
    const relevantWebhooks = Array.from(webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(event));

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data
    };

    // Deliver to all relevant webhooks
    const deliveryPromises = relevantWebhooks.map(webhook => 
      deliverWebhook(webhook, payload).catch(error => {
        console.error(`Webhook delivery failed for ${webhook.id}:`, error.message);
      })
    );

    await Promise.allSettled(deliveryPromises);
  } catch (error) {
    console.error('Error triggering webhooks:', error);
  }
};

/**
 * Get webhook statistics
 * GET /api/webhooks/stats
 */
const getWebhookStats = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userWebhooks = Array.from(webhooks.values())
      .filter(webhook => webhook.userId === userId);

    const totalWebhooks = userWebhooks.length;
    const activeWebhooks = userWebhooks.filter(w => w.active).length;
    const totalDeliveries = userWebhooks.reduce((sum, w) => sum + w.deliveryCount, 0);

    const recentDeliveries = Array.from(webhookDeliveries.values())
      .filter(delivery => {
        const webhook = webhooks.get(delivery.webhookId);
        return webhook && webhook.userId === userId;
      })
      .filter(delivery => {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        return new Date(delivery.createdAt) > oneDayAgo;
      });

    const successfulDeliveries = recentDeliveries.filter(d => d.status === 'delivered').length;
    const failedDeliveries = recentDeliveries.filter(d => d.status === 'failed').length;

    res.json({
      totalWebhooks,
      activeWebhooks,
      totalDeliveries,
      recentDeliveries: {
        total: recentDeliveries.length,
        successful: successfulDeliveries,
        failed: failedDeliveries,
        successRate: recentDeliveries.length > 0 
          ? Math.round((successfulDeliveries / recentDeliveries.length) * 100) 
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching webhook stats:', error);
    res.status(500).json({ error: 'Failed to fetch webhook statistics' });
  }
};

module.exports = {
  registerWebhook,
  getWebhooks,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  getWebhookStats,
  triggerWebhook, // Export for use in other controllers
  verifySignature // Export for webhook verification middleware
};