const TIMEZONES_SHEET_NAME = "timezones";


/**
 * Find next and next after hosts and send a message mentioning them
 *
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string} [responseUrl]
 */
function nextHostMessage(sheet, responseUrl) {
  const [next, nextAfter] = new Hosts(sheet).getNext();
  if (next) {
    const channelId = sheet.getName();
    new Slack().sendMessage(next, nextAfter, channelId, responseUrl);
  }
}


class Trigger {
  /**
   * @param {string} [triggerUid]
   */
  constructor(triggerUid = "") {
    /** @private */
    this.triggerUid = triggerUid;
  }

  /**
   * Find sheet by trigger UID stored on it
   *
   * @returns {SpreadsheetApp.Sheet}
   */
  findSheet() {
    const sheets = SpreadsheetApp.getActive().getSheets();
    return sheets.find((sheet) => sheet.getName() !== TIMEZONES_SHEET_NAME &&
      new Schedule(sheet).getTriggerUid() === this.triggerUid);
  }

  /**
   * Delete trigger
   */
  delete() {
    const triggers = ScriptApp.getProjectTriggers();
    const trigger = triggers.find((trigger) => trigger.getUniqueId() === this.triggerUid);
    if (trigger) {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  /**
   * Recreate a trigger and store its UID on a sheet named with channel ID
   *
   * @param {SpreadsheetApp.Sheet} sheet
   */
  replace(sheet) {
    LockService.getScriptLock().waitLock(60000);

    const schedule = new Schedule(sheet);
    if (!this.triggerUid) {
      this.triggerUid = schedule.getTriggerUid();
    }

    this.delete();

    const nextMeeting = schedule.getNextMeeting();
    if (nextMeeting) {
      const trigger = ScriptApp.newTrigger(onTimeDrivenEvent.name)
        .timeBased()
        .at(nextMeeting)
        .create();

      this.triggerUid = trigger.getUniqueId()
      schedule.setTriggerUid(this.triggerUid);
    } else {
      this.triggerUid = "";
      schedule.deleteTriggerUid();
    }
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
  const trigger = new Trigger(e.triggerUid);
  const sheet = trigger.findSheet();
  if (sheet) {
    nextHostMessage(sheet);
    trigger.replace(sheet);
  } else {
    trigger.delete();
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
    const sheet = e.range.getSheet();
    new Trigger().replace(sheet);
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
  const payload = JSON.parse(e.parameter.payload);
  const sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);

  switch (payload.actions[0].action_id) {
    case "next-host":
      nextHostMessage(sheet, payload.response_url);
      break;
    case "skip-meeting":
      new Hosts(sheet).skipMeeting();
      new Slack().markMessageSkipped(payload.message, payload.response_url)
      break;
  }

  return ContentService.createTextOutput("");
}
