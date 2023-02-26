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
    LockService.getScriptLock().waitLock(60000);

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
      let sheet, message, scheduleData;

      switch (action.action_id) {
        case "next-host":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            nextHostMessage(sheet, payload.response_url);
          } else {
            new Slack().disarmMessage(payload.message, payload.response_url);
          }
          break;
        case "skip-meeting":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            new Hosts(sheet).skipMeeting();
            new Slack().markMessageSkipped(payload.message, payload.response_url);
          } else {
            new Slack().disarmMessage(payload.message, payload.response_url);
          }
          break;
        case "toggle-host":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            const hosts = new Hosts(sheet);
            hosts.toggle(action.value);
            message = Slack.settingsHosts(hosts.all);
            new Slack().responseMessage(payload.response_url, message)
          }
          break;
        case "refresh-hosts":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            const slack = new Slack();
            message = Slack.settingsHosts();
            slack.responseMessage(payload.response_url, message);
            refreshHosts(sheet);
            message = Slack.settingsHosts(new Hosts(sheet).all);
            slack.responseMessage(payload.response_url, message);
          }
          break;
        case "set-time":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            Schedule.setTime(sheet, action.selected_time);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "clear-time":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            Schedule.setTime(sheet);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "set-timezone":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            Schedule.setTimeZone(sheet, action.selected_option.value);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "set-start-point":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            Schedule.setStartPoint(sheet, action.selected_date);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "add-week":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            Schedule.addWeek(sheet);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "remove-week":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            Schedule.removeWeek(sheet);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "toggle-day-0":
        case "toggle-day-1":
        case "toggle-day-2":
        case "toggle-day-3":
        case "toggle-day-4":
        case "toggle-day-5":
        case "toggle-day-6":
          sheet = SpreadsheetApp.getActive().getSheetByName(payload.channel.id);
          if (sheet) {
            const [week, day] = JSON.parse(action.value);
            Schedule.toggleDay(sheet, week, day);
            scheduleData = new Schedule(sheet).getScheduleData(true);
            message = Slack.settingsSchedule(scheduleData);
            new Slack().responseMessage(payload.response_url, message);
            new Trigger(scheduleData.triggerUid).replace(sheet);
          }
          break;
        case "close-settings":
          new Slack().deleteMessage(payload.response_url);
          break;
      }
    }
  } else if (e.postData.contents) {
    /** @type {{type: "url_verification" | "event_callback", challenge?: string,
     * api_app_id: string, event?: {type: "member_joined_channel" | "member_left_channel", channel: string, inviter?: string}}} */
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
                new Slack().sendEphemeral(contents.event.channel, contents.event.inviter);
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
