const TIMEZONES_SHEET_NAME = "timezones";
const [TRIGGER_UID_ROW, TRIGGER_UID_COLUMN] = [1, 9];


/**
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} [responseUrl]
 */
function nextHostMessage(sheet, responseUrl) {
  let [next, afterNext] = nextHosts(sheet);
  if (next) {
    let channelId = sheet.getName();
    sendMessage(next, afterNext, {channelId, responseUrl});
  }
}


/**
 * @param {string} triggerUid
 * @returns {SpreadsheetApp.Sheet}
 */
function findSheet(triggerUid) {
  let sheets = SpreadsheetApp.getActive().getSheets();
  return sheets.find(function (value) {
    return value.getName() !== TIMEZONES_SHEET_NAME && value.getRange(TRIGGER_UID_ROW, TRIGGER_UID_COLUMN).getValue().toString() === triggerUid
  });
}


/**
 * @param {string} triggerUid
 */
function deleteTrigger(triggerUid) {
  let triggers = ScriptApp.getProjectTriggers();
  let trigger = triggers.find(function (value) {return value.getUniqueId() === triggerUid});
  if (trigger) {
      ScriptApp.deleteTrigger(trigger);
  }
}


/**
 * @param {SpreadsheetApp.Sheet} sheet
 */
function replaceTrigger(sheet) {
  LockService.getScriptLock().waitLock(60000);

  let scheduleData = getScheduleData(sheet);

  deleteTrigger(scheduleData.triggerUid);

  let triggerRange = sheet.getRange(TRIGGER_UID_ROW, TRIGGER_UID_COLUMN);
  let nextMeeting = getNextMeeting(scheduleData);
  if (nextMeeting) {
    let trigger = ScriptApp.newTrigger(onTimeDrivenEvent.name)
      .timeBased()
      .at(nextMeeting)
      .create();

    triggerRange.setValue(trigger.getUniqueId());
  } else {
    triggerRange.clearContent();
  }
}


/**
 * @param {GoogleAppsScript.Events.TimeDriven} e
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
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */
function onEditEvent(e) {
  if (e.range.getColumn() > 5) {
    let sheet = e.range.getSheet();
    replaceTrigger(sheet);
  }
}



/**
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {GoogleAppsScript.Content.TextOutput}
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
      markMessageSkipped(payload.message, payload.response_url)
      break;
  }

  return ContentService.createTextOutput("");
}
