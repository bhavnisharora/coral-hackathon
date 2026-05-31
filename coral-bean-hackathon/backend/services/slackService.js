import axios from "axios";

export const sendSlackAlert = async (message) => {

  await axios.post(process.env.SLACK_WEBHOOK_URL, {
    text: message
  });
};