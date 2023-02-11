const TIMEZONES_SHEET_NAME = "timezones";


/**
 * Find next and next after hosts and send a message mentioning them
 *
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} [responseUrl]
 */
function nextHostMessage(sheet, responseUrl) {
  let [next, nextAfter] = nextHosts(sheet);
  if (next) {
    let channelId = sheet.getName();
    new Slack().sendMessage(next, nextAfter, channelId, responseUrl);
  }
}


/**
 * Find sheet by trigger UID stored on it
 *
 * @param {string} triggerUid
 * @returns {SpreadsheetApp.Sheet}
 */
function findSheet(triggerUid) {
  let sheets = SpreadsheetApp.getActive().getSheets();
  return sheets.find((sheet) => sheet.getName() !== TIMEZONES_SHEET_NAME &&
    new Schedule(sheet).getTriggerUid() === triggerUid);
}


/**
 * Delete specified trigger
 *
 * @param {string} triggerUid
 */
function deleteTrigger(triggerUid) {
  let triggers = ScriptApp.getProjectTriggers();
  let trigger = triggers.find((trigger) => trigger.getUniqueId() === triggerUid);
  if (trigger) {
      ScriptApp.deleteTrigger(trigger);
  }
}


/**
 * Recreate a trigger and store its UID on a sheet named with channel ID
 *
 * @param {SpreadsheetApp.Sheet} sheet
 */
function replaceTrigger(sheet) {
  LockService.getScriptLock().waitLock(60000);

  let schedule = new Schedule(sheet);

  deleteTrigger(schedule.getTriggerUid());

  let nextMeeting = schedule.getNextMeeting();
  if (nextMeeting) {
    let trigger = ScriptApp.newTrigger(onTimeDrivenEvent.name)
      .timeBased()
      .at(nextMeeting)
      .create();

    schedule.setTriggerUid(trigger.getUniqueId());
  } else {
    schedule.deleteTriggerUid();
  }
}


/**
 * Time trigger for Slack notifications
 * Recreate trigger for the next notification
 * Delete trigger if no sheet with channel ID could be found
 *
 * @param {Events.TimeDriven} e
 */
function onTimeDrivenEvent(e) {
  let sheet = findSheet(e.triggerUid);
  if (sheet) {
    nextHostMessage(sheet);
    replaceTrigger(sheet);
  } else {
    deleteTrigger(e.triggerUid);
  }
}


/**
 * Installable trigger for sheet edit events
 * Recreate a time trigger for the next Slack notification
 *
 * @param {Events.SheetsOnEdit} e
 */
function onEditEvent(e) {
  if (e.range.getColumn() > 5) {
    let sheet = e.range.getSheet();
    replaceTrigger(sheet);
  }
}



/**
 * Slack posts here using interactivity request URL
 * Handle button actions
 *
 * @param {Events.DoPost} e
 * @returns {Content.TextOutput}
 */
function doPost(e) {
  let payload = JSON.parse(e.parameter.payload);
  let sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);

  switch (payload.actions[0].action_id) {
    case "next-host":
      nextHostMessage(sheet, payload.response_url);
      break;
    case "skip-meeting":
      skipMeeting(sheet);
      new Slack().markMessageSkipped(payload.message, payload.response_url)
      break;
  }

  return ContentService.createTextOutput("");
}
