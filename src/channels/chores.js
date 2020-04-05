const callback_id = "modal_list";

function list(acts) {
  return {
    "type": "modal",
    "callback_id": callback_id,
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
        "block_id": "chore_input",
        "label": {
          "type": "plain_text",
          "text": "🧹 Choose a chore",
          "emoji": true
        },
        "element": {
          "type": "radio_buttons",
          "action_id": "chore_select",
          "options": mapActs(acts)
        }
      }
    ]
  }
}


function mapActs(acts) {
  return acts.map(act => {
    return {
      "text": {
        "type": "plain_text",
        "text": act.chore_name,
        "emoji": true
      },
      "value": act.id.toString(),
      "description": {
        "type": "plain_text",
        "text": act.value.toString()
      }
    }
  })
}

exports.callback_id = callback_id;
exports.list = list;
