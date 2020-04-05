const callbackId = "modal_list";

function list(acts) {
  return {
    "type": "modal",
    "callback_id": callbackId,
    "title": {
      "type": "plain_text",
      "text": "Chores",
      "emoji": true
    },
    "submit": {
      "type": "plain_text",
      "text": "Submit",
      "emoji": true
    },
    "close": {
      "type": "plain_text",
      "text": "Cancel",
      "emoji": true
    },
    "blocks": [
      {
        "type": "input",
        "block_id": "act_input",
        "label": {
          "type": "plain_text",
          "text": "🧹 Choose a chore",
          "emoji": true
        },
        "element": {
          "type": "radio_buttons",
          "action_id": "act_select",
          "options": mapActs(acts)
        }
      }
    ]
  }
}


function mapActs(acts) {
  return acts.map((act, index) => {
    return {
      "text": {
        "type": "plain_text",
        "text": act.chore_name,
        "emoji": true
      },
      "value": index.toString(),
      "description": {
        "type": "plain_text",
        "text": `${act.value}.${act.id}`
      }
    }
  })
}

exports.callbackId = callbackId;
exports.list = list;
