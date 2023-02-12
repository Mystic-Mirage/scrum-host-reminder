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
  /** @type {{actions: {action_id: "next-host" | "skip-meeting"}[], channel: {id: string}, message: Object, response_url: string}} */
  const payload = JSON.parse(e.parameter.payload);
  const sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);

  switch (payload.actions[0].action_id) {
    case "next-host":
      nextHostMessage(sheet, payload.response_url);
      break;
    case "skip-meeting":
      new Hosts(sheet).skipMeeting();
      new Slack().markMessageSkipped(payload.message, payload.response_url);
      break;
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
