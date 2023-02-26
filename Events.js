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
 * Update settings message with schedule data from a sheet and recreate a trigger
 *
 * @param {string} responseUrl
 * @param {SpreadsheetApp.Sheet} sheet
 */
function updateReminder(responseUrl, sheet) {
  const scheduleData = new Schedule(sheet).getScheduleData(true);
  new Slack().settingsScheduleMessage(responseUrl, scheduleData);
  new Trigger(scheduleData.triggerUid).replace(sheet);
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
     * actions: {action_id: "next-host" | "skip-meeting" | "toggle-host" | "refresh-hosts" |
     * "set-time" | "clear-time" | "set-timezone" | "set-start-point" | "add-week" | "remove-week" | "close-settings" |
     * "toggle-day-0" | "toggle-day-1" | "toggle-day-2" | "toggle-day-3" | "toggle-day-4" | "toggle-day-5" | "toggle-day-6",
     * value?: string, selected_time?: string, selected_option?: {value: string}, selected_date?: string}[],
     * channel: {id: string}, message: Object, response_url: string
     * }} */
    const payload = JSON.parse(e.parameter.payload);
    console.log(payload);

    for (const action of payload.actions) {
      if (action.action_id === "close-settings") {
        new Slack().deleteMessage(payload.response_url);
        continue;
      }
      LockService.getScriptLock().waitLock(60000);

      const sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
      if (sheet) {
        switch (action.action_id) {
          case "next-host":
            nextHostMessage(sheet, payload.response_url);
            break;
          case "skip-meeting":
            new Hosts(sheet).skipMeeting();
            new Slack().markMessageSkipped(payload.message, payload.response_url);
            break;
          case "toggle-host":
            const hosts = new Hosts(sheet);
            hosts.toggle(action.value);
            new Slack().settingsHostsMessage(payload.response_url, hosts.all)
            break;
          case "refresh-hosts":
            const slack = new Slack();
            slack.settingsHostsMessage(payload.response_url);
            refreshHosts(sheet);
            slack.settingsHostsMessage(payload.response_url, new Hosts(sheet).all);
            break;
          case "set-time":
            Schedule.setTime(sheet, action.selected_time);
            updateReminder(payload.response_url, sheet);
            break;
          case "clear-time":
            Schedule.setTime(sheet);
            updateReminder(payload.response_url, sheet);
            break;
          case "set-timezone":
            Schedule.setTimeZone(sheet, action.selected_option.value);
            updateReminder(payload.response_url, sheet);
            break;
          case "set-start-point":
            Schedule.setStartPoint(sheet, action.selected_date);
            updateReminder(payload.response_url, sheet);
            break;
          case "add-week":
            Schedule.addWeek(sheet);
            updateReminder(payload.response_url, sheet);
            break;
          case "remove-week":
            Schedule.removeWeek(sheet);
            updateReminder(payload.response_url, sheet);
            break;
          case "toggle-day-0":
          case "toggle-day-1":
          case "toggle-day-2":
          case "toggle-day-3":
          case "toggle-day-4":
          case "toggle-day-5":
          case "toggle-day-6":
            const [week, day] = JSON.parse(action.value);
            Schedule.toggleDay(sheet, week, day);
            updateReminder(payload.response_url, sheet);
            break;
        }
      } else {
        switch (action.action_id) {
          case "next-host":
            new Slack().disarmMessage(payload.message, payload.response_url);
            break;
          case "skip-meeting":
            new Slack().disarmMessage(payload.message, payload.response_url);
            break;
        }
      }
    }
  } else if (e.postData.contents) {
    /** @type {
     * {type: "url_verification", challenge: string} |
     * {type: "event_callback", api_app_id: string, event: {type: "member_joined_channel" | "member_left_channel", channel: string, inviter?: string}}
     * }
     */
    const contents = JSON.parse(e.postData.contents);
    console.log(contents);

    let sheet;
    switch (contents.type) {
      case "url_verification":
        return ContentService.createTextOutput(contents.challenge);
      case "event_callback":
        const props = PropertiesService.getScriptProperties().getProperties();
        if (contents.api_app_id === props.SLACK_APP_ID) {
          switch (contents.event.type) {
            case "member_joined_channel":
              sheet = SpreadsheetApp.getActive().getSheetByName(contents.event.channel);
              if (!sheet) {
                sheet = newSheet(contents.event.channel);
                refreshHosts(sheet);
                if (contents.event.inviter) {
                  new Slack().sendEphemeral(contents.event.channel, contents.event.inviter);
                }
              }
              break;
            case "member_left_channel":
              sheet = SpreadsheetApp.getActive().getSheetByName(contents.event.channel);
              if (sheet) {
                deleteSheet(sheet);
              }
              break;
          }
        }
    }
  } else {
    console.log(e);
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
    .addItem("Delete current channel", deleteChannel.name)
    .addToUi();
}
