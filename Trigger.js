const TIMEZONES_SHEET_NAME = "timezones";

/**
 * Wrapper for Google Apps Script triggers
 */
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
