import webpush from 'web-push';
import { getData, saveData, generateId } from './db';

// Configure VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@exhibition.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Sends a push notification to a specific user.
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  url: string = '/'
): Promise<{ success: boolean; sentCount: number }> {
  const data = await getData();
  const userSubs = data.pushSubscriptions.filter(sub => sub.userId === userId);
  
  if (userSubs.length === 0) {
    // Save to historical notifications list even if user is not currently subscribed to push
    await addHistoricalNotification(userId, title, body);
    return { success: true, sentCount: 0 };
  }

  let sentCount = 0;
  const expiredEndpoints: string[] = [];

  const payload = JSON.stringify({ title, body, url });

  for (const sub of userSubs) {
    try {
      const keysObj = JSON.parse(sub.keys);
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: keysObj.p256dh,
          auth: keysObj.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, payload);
      sentCount++;
    } catch (err: any) {
      console.error(`Failed to send push to endpoint: ${sub.endpoint}`, err.statusCode || err);
      // If subscription is expired/invalid (404 or 410), mark for deletion
      if (err.statusCode === 404 || err.statusCode === 410) {
        expiredEndpoints.push(sub.endpoint);
      }
    }
  }

  // Cleanup expired subscriptions
  if (expiredEndpoints.length > 0) {
    data.pushSubscriptions = data.pushSubscriptions.filter(
      sub => !expiredEndpoints.includes(sub.endpoint)
    );
    await saveData(data);
  }

  // Save to historical notifications list
  await addHistoricalNotification(userId, title, body);

  return { success: true, sentCount };
}

/**
 * Adds a notification record to the user's history in the DB.
 */
async function addHistoricalNotification(userId: string, title: string, body: string) {
  const data = await getData();
  const notif = {
    id: generateId(),
    userId,
    title,
    body,
    readAt: null,
    createdAt: new Date().toISOString(),
  };
  data.notifications.push(notif);
  await saveData(data);
}

/**
 * Checks all stage events and schedules notifications based on users' notification settings.
 * Designed to be called periodically (e.g. by a cron API).
 */
export async function checkAndSendUpcomingEventReminders(): Promise<{ sentCount: number }> {
  const data = await getData();
  const now = new Date();
  
  let totalSent = 0;

  // For each user
  for (const user of data.users) {
    // Get user's notification settings (timing rules)
    const userSettings = data.notificationSettings.filter(s => s.userId === user.id);
    if (userSettings.length === 0) continue;

    // Get user's favorited stage events
    const userFavs = data.favourites.filter(f => f.userId === user.id && f.type === 'STAGE_EVENT');
    if (userFavs.length === 0) continue;

    for (const fav of userFavs) {
      const event = data.stageEvents.find(e => e.id === fav.targetId);
      if (!event) continue;

      const eventStart = new Date(event.periodFrom);
      const timeDiffMs = eventStart.getTime() - now.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      // We only alert for events in the future (within next 24 hours)
      if (timeDiffHours <= 0 || timeDiffHours > 24) continue;

      for (const setting of userSettings) {
        // If the event starts in exactly this setting's hours range (e.g., within 15-minute margin of configured hours)
        const targetHours = setting.hoursBeforeEvent;
        
        // Define a window of 15 minutes (0.25 hours) to trigger the notification
        // For example, if configured for 1 hour before, trigger if the event starts in 45-60 mins
        // and we haven't already sent a reminder for this event + targetHours combination.
        const lowerBound = targetHours - 0.25;
        const upperBound = targetHours;

        if (timeDiffHours >= lowerBound && timeDiffHours <= upperBound) {
          // Check if we already sent a reminder to this user for this event and this specific timing
          const uniqueReminderKey = `Reminder: "${event.title}" starts in ${formatHours(targetHours)}`;
          const alreadySent = data.notifications.some(
            n => n.userId === user.id && 
                 n.title === uniqueReminderKey &&
                 (now.getTime() - new Date(n.createdAt).getTime()) < 4 * 60 * 60 * 1000 // within 4 hours
          );

          if (!alreadySent) {
            const body = `"${event.title}" at ${event.stageNumber} is starting soon (${event.speakerNames.join(', ')}).`;
            await sendPushNotification(user.id, uniqueReminderKey, body, `/stages/${event.id}`);
            totalSent++;
          }
        }
      }
    }
  }

  return { sentCount: totalSent };
}

function formatHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h === 1) return '1h';
  return `${h}h`;
}
