const TRIGGER_UID_RANGE = [1, 9];


/**
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} [responseUrl]
 */
function nextHostMessage(sheet, responseUrl) {
  if (host = nextHost(sheet)) {
    let channelId = sheet.getName();
    postMessage(host.slackId, {channelId, responseUrl});
  }
}


/**
 * @param {number} triggerUid
 * @returns {SpreadsheetApp.Sheet}
 */
function findSheet(triggerUid) {
  let sheets = SpreadsheetApp.getActive().getSheets();
  for (let sheet of sheets) {
    if (sheet.getRange(...TRIGGER_UID_RANGE).getValue() === triggerUid) {
      return sheet;
    }
  }
}


/**
 * @param {number} triggerUid
 */
function deleteTrigger(triggerUid) {
  let triggers = ScriptApp.getProjectTriggers();

  for (let trigger of triggers) {
    if (trigger.getUniqueId() === triggerUid) {
      ScriptApp.deleteTrigger(trigger);
      break;
    }
  }
}


/**
 * @param {SpreadsheetApp.Sheet} sheet
 */
function replaceTrigger(sheet) {
  LockService.getScriptLock().waitLock(60000);

  let scheduleData = getScheduleData(sheet);

  deleteTrigger(scheduleData.triggerUid);

  let range = sheet.getRange(...TRIGGER_UID_RANGE);
  if (nextMeeting = getNextMeeting(scheduleData)) {
    let trigger = ScriptApp.newTrigger(onTimeDrivenEvent.name)
      .timeBased()
      .at(nextMeeting)
      .create();

    range.setValue(trigger.getUniqueId());
  } else {
    range.clearContent();
  }
}


/**
 * @typedef {Object} TimeDrivenTriggerEvent
 * @property {number} triggerUid
 */


/**
 * @param {TimeDrivenTriggerEvent} e
 */
function onTimeDrivenEvent(e) {
  if (sheet = findSheet(e.triggerUid)) {
    nextHostMessage(sheet);
    replaceTrigger(sheet);
  } else {
    deleteTrigger(e.triggerUid);
  }
}


/**
 * @typedef {Object} SpreadsheetOnEditEvent
 * @property {SpreadsheetApp.Range} range
 */


/**
 * @param {SpreadsheetOnEditEvent} e
 */
function onEditEvent(e) {
  if (e.range.getColumn() > 5) {
    let sheet = e.range.getSheet();
    replaceTrigger(sheet);
  }
}


function doPost(e) {
  let payload = JSON.parse(e.parameter.payload);
  let actionId = payload.actions[0].action_id;
  let responseUrl = payload.response_url;
  let sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);

  switch (actionId) {
    case "next-host":
      nextHostMessage(sheet, responseUrl);
      break;
    case "skip-meeting":
      skipMeeting(sheet);
      deleteOriginalMessage(responseUrl);
      break;
  }

  return ContentService.createTextOutput("");
}
