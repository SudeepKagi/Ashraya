// FILE: server/services/notificationService.js
// Stub — replace with real FCM when Firebase is configured
const sendPush = async (fcmToken, title, body) => {
    // TODO: initialise firebase-admin and call messaging().send()
    console.log(`[FCM stub] To: ${fcmToken} | ${title}: ${body}`);
};

module.exports = { sendPush };