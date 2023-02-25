/**
 * Helper that connects events and Slack
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

/**
 * Installable trigger for Slack notifications
 * Recreate a trigger for the next notification or
 * delete it if no sheet with this trigger can be found
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
  if (e.parameter.command) {
    console.log(e.parameter);

    const sheet = SpreadsheetApp.getActive().getSheetByName(e.parameter.channel_id);
    if (sheet) {
      let message;

      switch (e.parameter.command) {
        case "/shr-hosts":
          const hosts = new Hosts(sheet);
          if (hosts.all) {
            message = Slack.settingsHosts(hosts.all);
            return ContentService.createTextOutput(JSON.stringify(message)).setMimeType(ContentService.MimeType.JSON);
          }
          break;
        case "/shr-schedule":
          const scheduleData = new Schedule(sheet).getScheduleData(true);
          if (scheduleData) {
            message = Slack.settingsSchedule(scheduleData);
            return ContentService.createTextOutput(JSON.stringify(message)).setMimeType(ContentService.MimeType.JSON);
          }
          break;
      }
    }
  } else if (e.parameter.payload) {
    /** @type {{
     * actions: {action_id: "next-host" | "skip-meeting" | "toggle-host" | "refresh-hosts" | "close-settings", value: string}[],
     * channel: {id: string}, message: Object, response_url: string
     * }} */
    const payload = JSON.parse(e.parameter.payload);
    console.log(payload);

    for (const action of payload.actions) {
      let sheet, message;

      switch (action.action_id) {
        case "next-host":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          nextHostMessage(sheet, payload.response_url);
          break;
        case "skip-meeting":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          new Hosts(sheet).skipMeeting();
          new Slack().markMessageSkipped(payload.message, payload.response_url);
          break;
        case "toggle-host":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          const hosts = new Hosts(sheet);
          hosts.toggle(action.value);
          message = Slack.settingsHosts(hosts.all);
          new Slack().responseMessage(payload.response_url, message)
          break;
        case "refresh-hosts":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          refreshHosts(sheet);
          message = Slack.settingsHosts(new Hosts(sheet).all);
          new Slack().responseMessage(payload.response_url, message);
          break;
        case "close-settings":
          new Slack().deleteMessage(payload.response_url);
          break;
      }
    }
  }

  return ContentService.createTextOutput("");
}

/**
 * Create a menu on spreadsheet open
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("Scrum Host Reminder")
    .addItem("Add Slack channel", addChannel.name)
    .addSeparator()
    .addItem("Re-read the channel members", reReadMembers.name)
    .addSeparator()
    .addItem("Delete current channel", deleteSheet.name)
    .addToUi();
}
