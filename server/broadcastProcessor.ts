import { storage } from "./storage";
import * as whatsappManager from "./whatsappManager";

// Track running broadcasts
const runningBroadcasts = new Map<string, NodeJS.Timeout>();

export async function processBroadcast(broadcastId: string) {
  console.log(`[Broadcast] Starting processor for broadcast ${broadcastId}`);

  // Check if already running
  if (runningBroadcasts.has(broadcastId)) {
    console.log(`[Broadcast] Already running for ${broadcastId}`);
    return;
  }

  const interval = setInterval(async () => {
    try {
      const broadcast = await storage.getBroadcast(broadcastId);

      if (!broadcast) {
        console.log(`[Broadcast] Broadcast ${broadcastId} not found, stopping`);
        stopBroadcast(broadcastId);
        return;
      }

      // Stop if paused or completed
      if (broadcast.status === 'paused') {
        console.log(`[Broadcast] Broadcast ${broadcastId} paused`);
        stopBroadcast(broadcastId);
        return;
      }

      if (broadcast.status === 'completed' || broadcast.status === 'failed') {
        console.log(`[Broadcast] Broadcast ${broadcastId} finished`);
        stopBroadcast(broadcastId);
        return;
      }

      // Get next pending contact
      const contacts = await storage.getBroadcastContacts(broadcastId);
      const nextContact = contacts.find(c => c.status === 'pending');

      if (!nextContact) {
        // All contacts processed
        await storage.updateBroadcast(broadcastId, {
          status: 'completed',
          completedAt: new Date(),
        });
        console.log(`[Broadcast] All contacts processed for ${broadcastId}`);
        stopBroadcast(broadcastId);
        return;
      }

      // Send message
      console.log(`[Broadcast] Sending message to ${nextContact.contactPhone}`);

      try {
        const sent = await whatsappManager.sendWhatsAppMessage(
          broadcast.deviceId,
          nextContact.contactPhone,
          broadcast.message,
          broadcast.mediaUrl,
          broadcast.mediaType
        );

        if (sent) {
          // Update contact status to sent
          await storage.updateBroadcastContact(nextContact.id, {
            status: 'sent',
            sentAt: new Date(),
          });

          // Update broadcast sent count
          await storage.updateBroadcast(broadcastId, {
            sentCount: broadcast.sentCount + 1,
          });

          console.log(`[Broadcast] Message sent successfully to ${nextContact.contactPhone}`);
        } else {
          throw new Error('Failed to send message');
        }
      } catch (error: any) {
        console.error(`[Broadcast] Error sending to ${nextContact.contactPhone}:`, error);

        // Update contact status to failed
        await storage.updateBroadcastContact(nextContact.id, {
          status: 'failed',
          errorMessage: error.message || 'Unknown error',
        });

        // Update broadcast failed count
        await storage.updateBroadcast(broadcastId, {
          failedCount: broadcast.failedCount + 1,
        });
      }

    } catch (error) {
      console.error(`[Broadcast] Error processing broadcast ${broadcastId}:`, error);

      // Mark as failed if too many errors
      await storage.updateBroadcast(broadcastId, {
        status: 'failed',
      });
      stopBroadcast(broadcastId);
    }
  }, 20000); // 20 seconds interval

  runningBroadcasts.set(broadcastId, interval);
}

export function stopBroadcast(broadcastId: string) {
  const interval = runningBroadcasts.get(broadcastId);
  if (interval) {
    clearInterval(interval);
    runningBroadcasts.delete(broadcastId);
    console.log(`[Broadcast] Stopped processor for ${broadcastId}`);
  }
}

export function stopAllBroadcasts() {
  runningBroadcasts.forEach((interval, broadcastId) => {
    clearInterval(interval);
    console.log(`[Broadcast] Stopped processor for ${broadcastId}`);
  });
  runningBroadcasts.clear();
}
