/**
 * @param {string} [responseUrl]
 */
function nextHostMessage(responseUrl) {
  let host = nextHost();
  if (host) {
    if (!responseUrl) {
      deleteLastMessage();
    }

    postMessage(host.slackId, responseUrl);
  }
}


function timeTrigger() {
  if (isMeetingTime()) {
    nextHostMessage();
  }
}


function onEdit(e) {
  let cache = CacheService.getScriptCache();
  cache.removeAll(
    [
      SCHEDULE_CACHE_KEY,
    ]
  );
}


function doPost(e) {
  let payload = JSON.parse(e.parameter.payload);
  let actionId = payload.actions[0].action_id;
  let responseUrl = payload.response_url;

  switch (actionId) {
    case "next-host":
      nextHostMessage(responseUrl);
      break;
    case "skip-meeting":
      skipMeeting();
      deleteOriginalMessage(responseUrl);
      break;
  }

  return ContentService.createTextOutput("");
}
